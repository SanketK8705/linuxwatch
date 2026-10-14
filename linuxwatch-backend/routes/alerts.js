const express = require('express');
const router = express.Router();
const pool = require('../db');
const { ingestEvent } = require('../engine/detector');
const authMiddleware = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { requireUserOrAdmin } = require('../middleware/role');

let ioRef = null;
const setIO = (io) => { ioRef = io; };

router.post('/events', authMiddleware, requireUserOrAdmin, validate('createEvent'), async (req, res) => {
  try {
    const result = await ingestEvent(ioRef, req.user.id, req.body);
    res.json({ status: 'ok', alert: result.alert, alerts: result.alerts, event: result.event });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/events', authMiddleware, requireUserOrAdmin, validate('listEvents'), async (req, res) => {
  const { event_type, limit = 100 } = req.query;
  let query = 'SELECT * FROM events';
  const params = [];
  if (req.user.role !== 'admin') {
    params.push(req.user.id);
    query += ` WHERE user_id=$${params.length}`;
  }
  if (event_type) {
    params.push(event_type);
    query += `${query.includes(' WHERE ') ? ' AND' : ' WHERE'} event_type=$${params.length}`;
  }
  query += ` ORDER BY timestamp DESC LIMIT $${params.length + 1}`;
  params.push(parseInt(limit, 10));
  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/alerts', authMiddleware, requireUserOrAdmin, validate('listAlerts'), async (req, res) => {
  const { severity, status, limit = 50 } = req.query;
  let query = 'SELECT * FROM alerts WHERE 1=1';
  const params = [];
  if (req.user.role !== 'admin') {
    params.push(req.user.id);
    query += ` AND user_id=$${params.length}`;
  }
  if (severity) { params.push(severity); query += ` AND severity=$${params.length}`; }
  if (status)   { params.push(status);   query += ` AND status=$${params.length}`; }
  query += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
  params.push(parseInt(limit, 10));
  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/alerts/:id', authMiddleware, requireUserOrAdmin, validate('patchAlert'), async (req, res) => {
  const { status } = req.body;

  if (req.user.role !== 'admin' && status === 'RESOLVED') {
    return res.status(403).json({ error: 'Users may only acknowledge alerts' });
  }

  try {
    const params = [status, req.params.id];
    let query = 'UPDATE alerts SET status=$1 WHERE id=$2';
    if (req.user.role !== 'admin') {
      params.push(req.user.id);
      query += ' AND user_id=$3';
    }
    query += ' RETURNING *';
    const result = await pool.query(query, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Alert not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/stats', authMiddleware, requireUserOrAdmin, async (req, res) => {
  try {
    const ownerClause = req.user.role === 'admin' ? '' : ' AND user_id=$1';
    const ownerParams = req.user.role === 'admin' ? [] : [req.user.id];
    const [alertCounts, eventCount, recentAlerts] = await Promise.all([
      pool.query(
        `SELECT severity, COUNT(*) as count FROM alerts WHERE status='OPEN'${ownerClause} GROUP BY severity`, ownerParams
      ),
      pool.query(
        `SELECT COUNT(*) as count FROM events WHERE timestamp > NOW() - INTERVAL '24 hours'${ownerClause}`, ownerParams
      ),
      pool.query(
        `SELECT * FROM alerts WHERE 1=1${req.user.role === 'admin' ? '' : ' AND user_id=$1'} ORDER BY created_at DESC LIMIT 5`, ownerParams
      ),
    ]);
    const bySeverity = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
    alertCounts.rows.forEach(r => { bySeverity[r.severity] = parseInt(r.count, 10); });
    res.json({
      openAlerts: Object.values(bySeverity).reduce((a, b) => a + b, 0),
      bySeverity,
      eventsLast24h: parseInt(eventCount.rows[0].count, 10),
      recentAlerts: recentAlerts.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = { router, setIO };
