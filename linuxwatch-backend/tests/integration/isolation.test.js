const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const pool = require('../../db');

const app = express();
app.use(cookieParser());
app.use(express.json());
const { router, setIO } = require('../../routes/alerts');
const authRouter = require('../../routes/auth');
setIO(null);
app.use('/api/auth', authRouter);
app.use('/api', router);

const suffix = Date.now();
const accounts = [
  { username: `isolation_a_${suffix}`, password: 'secret123' },
  { username: `isolation_b_${suffix}`, password: 'secret123' },
];
const userIds = [];

async function registerAndLogin(account) {
  const register = await request(app).post('/api/auth/register').send(account).expect(201);
  userIds.push(register.body.user.id);
  const login = await request(app).post('/api/auth/login').send(account).expect(200);
  return login.body.token;
}

afterAll(async () => {
  await pool.query('DELETE FROM alerts WHERE user_id = ANY($1::int[])', [userIds]);
  await pool.query('DELETE FROM events WHERE user_id = ANY($1::int[])', [userIds]);
  await pool.query('DELETE FROM users WHERE id = ANY($1::int[])', [userIds]);
  await pool.end();
});

test('users can ingest and read only their own events and alerts', async () => {
  const tokenA = await registerAndLogin(accounts[0]);
  const tokenB = await registerAndLogin(accounts[1]);

  await request(app)
    .post('/api/events')
    .set('Authorization', `Bearer ${tokenA}`)
    .send({ event_type: 'SQL_INJECTION', source_ip: '198.51.100.10', raw_log: 'owned by A' })
    .expect(200);

  await request(app)
    .post('/api/events')
    .set('Authorization', `Bearer ${tokenB}`)
    .send({ event_type: 'SSH_FAILED_LOGIN', source_ip: '198.51.100.11', raw_log: 'owned by B' })
    .expect(200);

  const eventsA = await request(app).get('/api/events').set('Authorization', `Bearer ${tokenA}`).expect(200);
  const eventsB = await request(app).get('/api/events').set('Authorization', `Bearer ${tokenB}`).expect(200);
  expect(eventsA.body).toHaveLength(1);
  expect(eventsA.body[0].raw_log).toBe('owned by A');
  expect(eventsB.body).toHaveLength(1);
  expect(eventsB.body[0].raw_log).toBe('owned by B');

  const alertsA = await request(app).get('/api/alerts').set('Authorization', `Bearer ${tokenA}`).expect(200);
  const alertsB = await request(app).get('/api/alerts').set('Authorization', `Bearer ${tokenB}`).expect(200);
  expect(alertsA.body).toHaveLength(1);
  expect(alertsA.body[0].source_ip).toBe('198.51.100.10');
  expect(alertsB.body).toHaveLength(0);
});