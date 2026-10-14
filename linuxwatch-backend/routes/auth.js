const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { validate } = require('../middleware/validate');
const authMiddleware = require('../middleware/auth');
const { setAuthCookie, clearAuthCookie } = require('../middleware/auth');
const { ingestEvent } = require('../engine/detector');

const JWT_SECRET = process.env.JWT_SECRET || 'linuxwatch_secret';
let ioRef = null;
const setIO = (io) => { ioRef = io; };

function getSourceIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  const raw = Array.isArray(forwarded) ? forwarded[0] : (forwarded || req.ip || req.socket.remoteAddress || '127.0.0.1');
  return String(raw).split(',')[0].trim().replace(/^::ffff:/, '') || '127.0.0.1';
}

async function getSecurityOwnerId() {
  const configured = Number(process.env.SYSTEM_USER_ID);
  if (Number.isInteger(configured) && configured > 0) return configured;
  const result = await pool.query("SELECT id FROM users WHERE role='admin' ORDER BY id LIMIT 1");
  return result.rows[0]?.id || 1;
}

async function recordFailedLogin(req, username) {
  try {
    await ingestEvent(ioRef, await getSecurityOwnerId(), {
      event_type: 'CREDENTIAL_STUFFING',
      source_ip: getSourceIp(req),
      username,
      raw_log: `Failed web login for ${username} from ${getSourceIp(req)}`,
    });
  } catch (err) {
    console.error('Credential stuffing event error:', err.message);
  }
}

router.post('/register', validate('register'), async (req, res) => {
  const { username, password } = req.body;
  try {
    const count = await pool.query('SELECT COUNT(*)::int AS n FROM users');
    const role = count.rows[0].n === 0 ? 'admin' : 'user';

    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING id, username, role',
      [username, hash, role]
    );
    res.status(201).json({ user: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Username already exists' });
    console.error('Register error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/login', validate('login'), async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    const user = result.rows[0];
    if (!user) {
      await recordFailedLogin(req, username);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      await recordFailedLogin(req, username);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    setAuthCookie(res, token);
    res.json({ username: user.username, role: user.role, token });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

router.get('/me', authMiddleware, (req, res) => {
  res.json({ id: req.user.id, username: req.user.username, role: req.user.role });
});

module.exports = router;
module.exports.setIO = setIO;
