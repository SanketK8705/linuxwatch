const { shouldCountHttpFlood, normalizeClientIp } = require('../../middleware/webSecurity');

function request(path, method = 'GET', headers = {}) {
  return {
    path,
    method,
    headers,
    ip: '::ffff:192.0.2.10',
    socket: { remoteAddress: '192.0.2.10' },
  };
}

describe('web security request classification', () => {
  test('does not count agent event ingestion as HTTP flood traffic', () => {
    expect(shouldCountHttpFlood(request('/api/events', 'POST'))).toBe(false);
  });

  test('does not count dashboard polling as HTTP flood traffic', () => {
    expect(shouldCountHttpFlood(request('/api/stats'))).toBe(false);
    expect(shouldCountHttpFlood(request('/api/alerts'))).toBe(false);
  });

  test('counts public login traffic as HTTP flood traffic', () => {
    expect(shouldCountHttpFlood(request('/api/auth/login', 'POST'))).toBe(true);
  });

  test('normalizes forwarded and IPv4-mapped addresses', () => {
    expect(normalizeClientIp(request('/api/auth/login', 'POST', { 'x-forwarded-for': '::ffff:198.51.100.7, 10.0.0.1' }))).toBe('198.51.100.7');
  });
});