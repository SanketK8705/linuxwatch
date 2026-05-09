const express = require('express');
const router = express.Router();
const pool = require('../db');
const { processEvent } = require('../engine/detector');
const authMiddleware = require('../middleware/auth');

let ioRef = null;
const setIO = (io) => { ioRef = io; };

// POST /api/events — from Python agent / simulate.js
router.post('/events', authMiddleware, async (req, res) => {
  const { event_type, source_ip, username, raw_log, malware_type, clicked } = req.body;
  if (!event_type) return res.status(400).json({ error: 'event_type required' });
  const userId = req.user.id;
  try {
    await pool.query(
      'INSERT INTO events (user_id, event_type, source_ip, username, raw_log) VALUES ($1,$2,$3,$4,$5)',
      [userId, event_type, source_ip, username, raw_log]
    );
    const alert = await processEvent(ioRef, userId, {
      event_type, source_ip, username, malware_type, clicked
    });
    res.json({ status: 'ok', alert: alert || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/events — only this user's events, filterable by event_type
router.get('/events', authMiddleware, async (req, res) => {
  const { event_type, limit = 100 } = req.query;
  const userId = req.user.id;
  let query = 'SELECT * FROM events WHERE user_id=$1';
  const params = [userId];
  if (event_type) {
    params.push(event_type);
    query += ` AND event_type=$${params.length}`;
  }
  query += ` ORDER BY timestamp DESC LIMIT $${params.length + 1}`;
  params.push(parseInt(limit));
  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/alerts — only this user's alerts
router.get('/alerts', authMiddleware, async (req, res) => {
  const { severity, status, limit = 50 } = req.query;
  const userId = req.user.id;
  let query = 'SELECT * FROM alerts WHERE user_id=$1';
  const params = [userId];
  if (severity) { params.push(severity); query += ` AND severity=$${params.length}`; }
  if (status)   { params.push(status);   query += ` AND status=$${params.length}`; }
  query += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
  params.push(parseInt(limit));
  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/alerts/:id — only own alerts
router.patch('/alerts/:id', authMiddleware, async (req, res) => {
  const { status } = req.body;
  const userId = req.user.id;
  if (!['ACKNOWLEDGED', 'RESOLVED'].includes(status))
    return res.status(400).json({ error: 'Invalid status' });
  try {
    const result = await pool.query(
      'UPDATE alerts SET status=$1 WHERE id=$2 AND user_id=$3 RETURNING *',
      [status, req.params.id, userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Alert not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/stats — only this user's stats
router.get('/stats', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  try {
    const [alertCounts, eventCount, recentAlerts] = await Promise.all([
      pool.query(
        `SELECT severity, COUNT(*) as count FROM alerts WHERE status='OPEN' AND user_id=$1 GROUP BY severity`,
        [userId]
      ),
      pool.query(
        `SELECT COUNT(*) as count FROM events WHERE timestamp > NOW() - INTERVAL '24 hours' AND user_id=$1`,
        [userId]
      ),
      pool.query(
        `SELECT * FROM alerts WHERE user_id=$1 ORDER BY created_at DESC LIMIT 5`,
        [userId]
      ),
    ]);
    const bySeverity = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
    alertCounts.rows.forEach(r => { bySeverity[r.severity] = parseInt(r.count); });
    res.json({
      openAlerts: Object.values(bySeverity).reduce((a, b) => a + b, 0),
      bySeverity,
      eventsLast24h: parseInt(eventCount.rows[0].count),
      recentAlerts: recentAlerts.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = { router, setIO };