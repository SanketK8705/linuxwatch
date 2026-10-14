/**
 * Unit tests for middleware/role.js
 */

const { requireRole, requireAdmin, requireAnalystOrAdmin } = require('../../middleware/role');

function makeMockReqRes(user = null) {
  const req = { user };
  const res = {
    _status: 200,
    _json: null,
    status(code) { this._status = code; return this; },
    json(body) { this._json = body; return this; },
  };
  const next = jest.fn();
  return { req, res, next };
}

describe('requireRole', () => {
  test('returns 401 when req.user is missing', () => {
    const mw = requireRole('admin');
    const { req, res, next } = makeMockReqRes(null);
    mw(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(401);
    expect(res._json.error).toBe('Unauthorized');
  });

  test('returns 403 when user role is not in allowed list', () => {
    const mw = requireRole('admin');
    const { req, res, next } = makeMockReqRes({ role: 'analyst' });
    mw(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(403);
    expect(res._json.error).toBe('Insufficient permissions');
  });

  test('calls next when role matches', () => {
    const mw = requireRole('admin');
    const { req, res, next } = makeMockReqRes({ role: 'admin' });
    mw(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('supports multiple roles', () => {
    const mw = requireRole('admin', 'analyst');
    const { req, res, next } = makeMockReqRes({ role: 'analyst' });
    mw(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});

describe('requireAdmin', () => {
  test('blocks analyst', () => {
    const { req, res, next } = makeMockReqRes({ role: 'analyst' });
    requireAdmin(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(403);
  });

  test('allows admin', () => {
    const { req, res, next } = makeMockReqRes({ role: 'admin' });
    requireAdmin(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});

describe('requireAnalystOrAdmin', () => {
  test('allows analyst', () => {
    const { req, res, next } = makeMockReqRes({ role: 'analyst' });
    requireAnalystOrAdmin(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('allows admin', () => {
    const { req, res, next } = makeMockReqRes({ role: 'admin' });
    requireAnalystOrAdmin(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('blocks unknown role', () => {
    const { req, res, next } = makeMockReqRes({ role: 'viewer' });
    requireAnalystOrAdmin(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(403);
  });
});
