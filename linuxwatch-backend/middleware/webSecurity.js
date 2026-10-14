const { ingestEvent } = require('../engine/detector');
const jwt = require('jsonwebtoken');
const pool = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'linuxwatch_secret';

// Regex for SQL Injection in query params, url, headers, or body
const RE_SQL = /(?:union\s+(?:all\s+)?select|or\s+['"]?1['"]?\s*=\s*['"]?1|or\s+1\s*=\s*1|drop\s+(?:table|database)|insert\s+into|delete\s+from|select\s+.*\s+from|sleep\s*\(|benchmark\s*\(|'--|";--|';|\bxp_\w+)/i;

const INTERNAL_RATE_LIMIT_PATHS = new Set([
  '/api/events',
  '/api/alerts',
  '/api/stats',
  '/api/auth/me',
  '/api/auth/logout',
]);

function normalizeClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = Array.isArray(forwarded) ? forwarded[0] : (forwarded || req.ip || req.socket.remoteAddress || '127.0.0.1');
  return String(ip).split(',')[0].trim().replace(/^::ffff:/, '') || '127.0.0.1';
}

function shouldCountHttpFlood(req) {
  return req.method !== 'OPTIONS'
    && !INTERNAL_RATE_LIMIT_PATHS.has(req.path)
    && req.path !== '/health';
}

async function resolveSecurityUser(req) {
  if (req.user) return req.user;

  const authHeader = req.headers.authorization;
  const cookieToken = String(req.headers.cookie || '').match(/(?:^|;\s*)lw_token=([^;]+)/)?.[1];
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : cookieToken;
  if (token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      const result = await pool.query('SELECT id, username, role FROM users WHERE id=$1', [payload.id]);
      if (result.rows.length) return result.rows[0];
    } catch {
      // Unauthenticated traffic is assigned to the system owner below.
    }
  }

  const configuredSystemUser = Number(process.env.SYSTEM_USER_ID);
  if (Number.isInteger(configuredSystemUser) && configuredSystemUser > 0) {
    return { id: configuredSystemUser, username: 'system', role: 'admin' };
  }

  const result = await pool.query("SELECT id, username, role FROM users WHERE role='admin' ORDER BY id LIMIT 1");
  return result.rows[0] || { id: 1, username: 'system', role: 'admin' };
}

/**
 * Middleware to capture real-time HTTP traffic and inspect for:
 * 1. SQL Injection attempts in URL parameters or request body.
 * 2. HTTP Flood / DDoS request bursts per source IP.
 */
function webSecurityMiddleware(getIO) {
  return async (req, res, next) => {
    const cleanIp = normalizeClientIp(req);

    try {
      const io = getIO ? getIO() : null;
      const securityUser = await resolveSecurityUser(req);
      const systemUserId = securityUser.id;

      // Count public application traffic, but never agent telemetry or dashboard polling.
      if (shouldCountHttpFlood(req)) {
        ingestEvent(io, systemUserId, {
          event_type: 'HTTP_FLOOD',
          source_ip: cleanIp,
          raw_log: `${req.method} ${req.originalUrl} HTTP/${req.httpVersion}`,
        }).catch(err => console.error('[WebSecurity] HTTP_FLOOD ingest error:', err.message));
      }

      // 2. Check SQL Injection in URL, query parameters, or stringified body (with URL decoding)
      let rawUrl = req.originalUrl || req.url || '';
      try { rawUrl = decodeURIComponent(rawUrl); } catch (e) {}

      let bodyStr = req.body ? JSON.stringify(req.body) : '';
      try { bodyStr = decodeURIComponent(bodyStr); } catch (e) {}

      if (!INTERNAL_RATE_LIMIT_PATHS.has(req.path) && (RE_SQL.test(rawUrl) || RE_SQL.test(bodyStr))) {
        console.log(`[WebSecurity] SQL Injection detected from ${cleanIp} on ${rawUrl}`);
        ingestEvent(io, systemUserId, {
          event_type: 'SQL_INJECTION',
          source_ip: cleanIp,
          username: req.user ? req.user.username : null,
          raw_log: `SQL Injection attempt on ${req.method} ${rawUrl} | Body: ${bodyStr.slice(0, 200)}`,
        }).catch(err => console.error('[WebSecurity] SQL_INJECTION ingest error:', err.message));
      }
    } catch (err) {
      console.error('[WebSecurity] Error running security middleware:', err);
    }

    next();
  };
}

module.exports = webSecurityMiddleware;
module.exports.normalizeClientIp = normalizeClientIp;
module.exports.shouldCountHttpFlood = shouldCountHttpFlood;
module.exports.resolveSecurityUser = resolveSecurityUser;
