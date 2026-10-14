/**
 * Unit tests for middleware/validate.js (Zod schemas)
 */

const { validate, schemas } = require('../../middleware/validate');

// ── Helpers ────────────────────────────────────────────────────────────────

function makeMockReqRes(overrides = {}) {
  const req = {
    body: {},
    query: {},
    params: {},
    ...overrides,
  };
  const res = {
    _status: 200,
    _json: null,
    status(code) { this._status = code; return this; },
    json(body) { this._json = body; return this; },
  };
  const next = jest.fn();
  return { req, res, next };
}

// ── register schema ───────────────────────────────────────────────────────

describe('validate("register")', () => {
  const mw = validate('register');

  test('valid registration passes', () => {
    const { req, res, next } = makeMockReqRes({ body: { username: 'alice', password: 'secret123' } });
    mw(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('empty username fails', () => {
    const { req, res, next } = makeMockReqRes({ body: { username: '', password: 'secret123' } });
    mw(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(400);
    expect(res._json.error).toBe('Validation failed');
  });

  test('password too short fails', () => {
    const { req, res, next } = makeMockReqRes({ body: { username: 'alice', password: 'abc' } });
    mw(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(400);
  });

  test('username with special characters fails', () => {
    const { req, res, next } = makeMockReqRes({ body: { username: 'al!ce@#', password: 'secret123' } });
    mw(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(400);
  });

  test('username with allowed special chars (dot, dash, underscore) passes', () => {
    const { req, res, next } = makeMockReqRes({ body: { username: 'al.ice-bob_1', password: 'secret123' } });
    mw(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('username over 50 chars fails', () => {
    const { req, res, next } = makeMockReqRes({ body: { username: 'a'.repeat(51), password: 'secret123' } });
    mw(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(400);
  });

  test('password over 128 chars fails', () => {
    const { req, res, next } = makeMockReqRes({ body: { username: 'alice', password: 'x'.repeat(129) } });
    mw(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(400);
  });

  test('missing password fails', () => {
    const { req, res, next } = makeMockReqRes({ body: { username: 'alice' } });
    mw(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(400);
  });
});

// ── login schema ──────────────────────────────────────────────────────────

describe('validate("login")', () => {
  const mw = validate('login');

  test('valid login passes', () => {
    const { req, res, next } = makeMockReqRes({ body: { username: 'bob', password: 'pass1234' } });
    mw(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('missing both fields fails', () => {
    const { req, res, next } = makeMockReqRes({ body: {} });
    mw(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(400);
    expect(res._json.details.length).toBeGreaterThan(0);
  });
});

// ── createEvent schema ────────────────────────────────────────────────────

describe('validate("createEvent")', () => {
  const mw = validate('createEvent');

  test('valid event passes', () => {
    const { req, res, next } = makeMockReqRes({
      body: { event_type: 'SSH_FAILED_LOGIN', source_ip: '1.2.3.4', username: 'root', raw_log: 'test' },
    });
    mw(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('missing event_type fails', () => {
    const { req, res, next } = makeMockReqRes({ body: { source_ip: '1.2.3.4' } });
    mw(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(400);
  });

  test('event_type too long fails', () => {
    const { req, res, next } = makeMockReqRes({ body: { event_type: 'X'.repeat(51) } });
    mw(req, res, next);
    expect(next).not.toHaveBeenCalled();
  });

  test('port out of range fails', () => {
    const { req, res, next } = makeMockReqRes({
      body: { event_type: 'PORT_SCAN', port: 70000 },
    });
    mw(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(400);
  });

  test('valid port passes', () => {
    const { req, res, next } = makeMockReqRes({
      body: { event_type: 'PORT_SCAN', port: 443 },
    });
    mw(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('port 0 passes (boundary)', () => {
    const { req, res, next } = makeMockReqRes({
      body: { event_type: 'PORT_SCAN', port: 0 },
    });
    mw(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('port 65535 passes (boundary)', () => {
    const { req, res, next } = makeMockReqRes({
      body: { event_type: 'PORT_SCAN', port: 65535 },
    });
    mw(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('optional fields can be null', () => {
    const { req, res, next } = makeMockReqRes({
      body: { event_type: 'SSH_FAILED_LOGIN', source_ip: null, username: null, raw_log: null },
    });
    mw(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});

// ── listAlerts schema ─────────────────────────────────────────────────────

describe('validate("listAlerts")', () => {
  const mw = validate('listAlerts');

  test('no query params passes', () => {
    const { req, res, next } = makeMockReqRes({ query: {} });
    mw(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('valid severity filter passes', () => {
    const { req, res, next } = makeMockReqRes({ query: { severity: 'HIGH' } });
    mw(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('invalid severity fails', () => {
    const { req, res, next } = makeMockReqRes({ query: { severity: 'EXTREME' } });
    mw(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(400);
  });

  test('valid status filter passes', () => {
    const { req, res, next } = makeMockReqRes({ query: { status: 'OPEN' } });
    mw(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('invalid status fails', () => {
    const { req, res, next } = makeMockReqRes({ query: { status: 'DELETED' } });
    mw(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(400);
  });

  test('limit over 500 fails', () => {
    const { req, res, next } = makeMockReqRes({ query: { limit: '501' } });
    mw(req, res, next);
    expect(next).not.toHaveBeenCalled();
  });

  test('limit 0 fails', () => {
    const { req, res, next } = makeMockReqRes({ query: { limit: '0' } });
    mw(req, res, next);
    expect(next).not.toHaveBeenCalled();
  });
});

// ── patchAlert schema ─────────────────────────────────────────────────────

describe('validate("patchAlert")', () => {
  const mw = validate('patchAlert');

  test('valid ACKNOWLEDGED status passes', () => {
    const { req, res, next } = makeMockReqRes({ params: { id: '1' }, body: { status: 'ACKNOWLEDGED' } });
    mw(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('valid RESOLVED status passes', () => {
    const { req, res, next } = makeMockReqRes({ params: { id: '2' }, body: { status: 'RESOLVED' } });
    mw(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('setting status to OPEN fails (can\'t reopen)', () => {
    const { req, res, next } = makeMockReqRes({ params: { id: '1' }, body: { status: 'OPEN' } });
    mw(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(400);
  });

  test('non-numeric id fails', () => {
    const { req, res, next } = makeMockReqRes({ params: { id: 'abc' }, body: { status: 'RESOLVED' } });
    mw(req, res, next);
    expect(next).not.toHaveBeenCalled();
  });

  test('negative id fails', () => {
    const { req, res, next } = makeMockReqRes({ params: { id: '-1' }, body: { status: 'RESOLVED' } });
    mw(req, res, next);
    expect(next).not.toHaveBeenCalled();
  });
});

// ── aiSummarize schema ────────────────────────────────────────────────────

describe('validate("aiSummarize")', () => {
  const mw = validate('aiSummarize');

  test('empty body passes (all optional)', () => {
    const { req, res, next } = makeMockReqRes({ body: {} });
    mw(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('limit over 200 fails', () => {
    const { req, res, next } = makeMockReqRes({ body: { limit: 201 } });
    mw(req, res, next);
    expect(next).not.toHaveBeenCalled();
  });

  test('hours over 168 fails (max 1 week)', () => {
    const { req, res, next } = makeMockReqRes({ body: { hours: 200 } });
    mw(req, res, next);
    expect(next).not.toHaveBeenCalled();
  });
});

// ── aiAsk schema ──────────────────────────────────────────────────────────

describe('validate("aiAsk")', () => {
  const mw = validate('aiAsk');

  test('valid question passes', () => {
    const { req, res, next } = makeMockReqRes({ body: { question: 'What IPs are attacking?' } });
    mw(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('missing question fails', () => {
    const { req, res, next } = makeMockReqRes({ body: {} });
    mw(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(400);
  });

  test('question over 1000 chars fails', () => {
    const { req, res, next } = makeMockReqRes({ body: { question: 'x'.repeat(1001) } });
    mw(req, res, next);
    expect(next).not.toHaveBeenCalled();
  });
});

// ── Edge case: unknown schema name ────────────────────────────────────────

describe('validate() edge cases', () => {
  test('unknown schema name throws', () => {
    expect(() => validate('nonexistent')).toThrow('Unknown schema: nonexistent');
  });
});
