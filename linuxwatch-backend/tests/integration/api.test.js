/**
 * Integration tests for API routes
 *
 * These use supertest to test the Express app end-to-end.
 * They require a running PostgreSQL database with the linuxwatch schema.
 *
 * Set DB_NAME=linuxwatch_test (or similar) to avoid polluting production data.
 * The tests create a test user, run through the full auth + events + alerts flow,
 * then clean up after themselves.
 */

const request = require('supertest');
const http = require('http');
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const pool = require('../../db');

// ── Build a test app (mirrors server.js but without listen) ───────────────

function buildApp() {
  const app = express();
  app.use(cors({ origin: true, credentials: true }));
  app.use(cookieParser());
  app.use(express.json({ limit: '32kb' }));

  const { router: alertsRouter, setIO } = require('../../routes/alerts');
  const authRouter = require('../../routes/auth');

  setIO(null); // no real Socket.io for tests

  app.use('/api/auth', authRouter);
  app.use('/api', alertsRouter);

  return app;
}

// ── Test Config ───────────────────────────────────────────────────────────

const TEST_USER = `testuser_${Date.now()}`;
const TEST_PASS = 'testpass123';
let token = '';
let userId = 0;
let app;

beforeAll(async () => {
  app = buildApp();
});

afterAll(async () => {
  // Cleanup test data
  try {
    if (userId) {
      await pool.query('DELETE FROM alerts WHERE user_id=$1', [userId]);
      await pool.query('DELETE FROM events WHERE user_id=$1', [userId]);
      await pool.query('DELETE FROM users WHERE id=$1', [userId]);
    }
  } catch (e) {
    console.error('Cleanup error:', e.message);
  }
  await pool.end();
});

// ── Auth Routes ───────────────────────────────────────────────────────────

describe('POST /api/auth/register', () => {
  test('registers a new user successfully', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: TEST_USER, password: TEST_PASS })
      .expect(201);

    expect(res.body.user).toBeDefined();
    expect(res.body.user.username).toBe(TEST_USER);
    expect(res.body.user.id).toBeDefined();
    userId = res.body.user.id;
  });

  test('duplicate username returns 409', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ username: TEST_USER, password: TEST_PASS })
      .expect(409);
  });

  test('short password returns 400', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'newuser', password: '12' })
      .expect(400);
  });

  test('missing fields returns 400', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({})
      .expect(400);
  });
});

describe('POST /api/auth/login', () => {
  test('logs in with correct credentials', async () => {
    // Make sure user is admin so event creation and admin routes can be tested
    await pool.query("UPDATE users SET role='admin' WHERE id=$1", [userId]);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: TEST_USER, password: TEST_PASS })
      .expect(200);

    expect(res.body.token).toBeDefined();
    expect(res.body.username).toBe(TEST_USER);
    token = res.body.token;
  });

  test('wrong password returns 401', async () => {
    await request(app)
      .post('/api/auth/login')
      .send({ username: TEST_USER, password: 'wrongpassword' })
      .expect(401);
  });

  test('non-existent user returns 401', async () => {
    await request(app)
      .post('/api/auth/login')
      .send({ username: 'nonexistent_user_xyz', password: 'pass1234' })
      .expect(401);
  });
});

describe('GET /api/auth/me', () => {
  test('returns user info with valid token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.username).toBe(TEST_USER);
    expect(res.body.id).toBe(userId);
    expect(res.body.role).toBeDefined();
  });

  test('returns 401 without token', async () => {
    await request(app)
      .get('/api/auth/me')
      .expect(401);
  });

  test('returns 401 with invalid token', async () => {
    await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid_token_xyz')
      .expect(401);
  });
});

describe('POST /api/auth/logout', () => {
  test('logout succeeds', async () => {
    const res = await request(app)
      .post('/api/auth/logout')
      .expect(200);

    expect(res.body.ok).toBe(true);
  });
});

// ── Events Routes ─────────────────────────────────────────────────────────

describe('POST /api/events', () => {
  // This route requires 'admin' role. Our test user may be analyst.
  // We'll handle both cases.

  test('creates an event (admin only)', async () => {
    // First check the user's role
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    if (meRes.body.role !== 'admin') {
      // Skip this test for non-admin users
      const res = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${token}`)
        .send({ event_type: 'SSH_FAILED_LOGIN', source_ip: '1.2.3.4', username: 'test' })
        .expect(403);
      return;
    }

    const res = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${token}`)
      .send({
        event_type: 'SSH_FAILED_LOGIN',
        source_ip: '10.0.0.1',
        username: 'testuser',
        raw_log: 'Failed password for testuser from 10.0.0.1 port 22',
      })
      .expect(200);

    expect(res.body.status).toBe('ok');
    expect(res.body.event).toBeDefined();
    expect(res.body.event.event_type).toBe('SSH_FAILED_LOGIN');
  });

  test('rejects without auth', async () => {
    await request(app)
      .post('/api/events')
      .send({ event_type: 'SSH_FAILED_LOGIN' })
      .expect(401);
  });

  test('rejects invalid event_type (empty)', async () => {
    await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${token}`)
      .send({ event_type: '' })
      .expect(400);
  });
});

// ── Alerts Routes ─────────────────────────────────────────────────────────

describe('GET /api/alerts', () => {
  test('returns alerts array with valid auth', async () => {
    const res = await request(app)
      .get('/api/alerts')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
  });

  test('supports severity filter', async () => {
    const res = await request(app)
      .get('/api/alerts?severity=CRITICAL')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    res.body.forEach(alert => {
      expect(alert.severity).toBe('CRITICAL');
    });
  });

  test('supports status filter', async () => {
    const res = await request(app)
      .get('/api/alerts?status=OPEN')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    res.body.forEach(alert => {
      expect(alert.status).toBe('OPEN');
    });
  });

  test('rejects invalid severity value', async () => {
    await request(app)
      .get('/api/alerts?severity=EXTREME')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  });

  test('rejects without auth', async () => {
    await request(app)
      .get('/api/alerts')
      .expect(401);
  });
});

describe('GET /api/events', () => {
  test('returns events array with valid auth', async () => {
    const res = await request(app)
      .get('/api/events')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
  });

  test('supports event_type filter', async () => {
    const res = await request(app)
      .get('/api/events?event_type=SSH_FAILED_LOGIN')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
  });

  test('supports limit parameter', async () => {
    const res = await request(app)
      .get('/api/events?limit=5')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.length).toBeLessThanOrEqual(5);
  });
});

// ── Stats Routes ──────────────────────────────────────────────────────────

describe('GET /api/stats', () => {
  test('returns stats object with valid auth', async () => {
    const res = await request(app)
      .get('/api/stats')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.openAlerts).toBeDefined();
    expect(res.body.bySeverity).toBeDefined();
    expect(res.body.bySeverity).toHaveProperty('LOW');
    expect(res.body.bySeverity).toHaveProperty('MEDIUM');
    expect(res.body.bySeverity).toHaveProperty('HIGH');
    expect(res.body.bySeverity).toHaveProperty('CRITICAL');
    expect(res.body.eventsLast24h).toBeDefined();
    expect(res.body.recentAlerts).toBeDefined();
    expect(Array.isArray(res.body.recentAlerts)).toBe(true);
  });

  test('rejects without auth', async () => {
    await request(app)
      .get('/api/stats')
      .expect(401);
  });
});
