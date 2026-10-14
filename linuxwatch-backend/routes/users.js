const express = require('express');
const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { requireAdmin } = require('../middleware/role');

router.get('/', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, role, created_at FROM users ORDER BY created_at ASC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('List users error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/:id/role', authMiddleware, requireAdmin, validate('patchUserRole'), async (req, res) => {
  const userId = Number(req.params.id);
  const { role } = req.body;
  if (userId === req.user.id && role !== 'admin') {
    return res.status(400).json({ error: 'You cannot remove your own admin access' });
  }

  try {
    if (role !== 'admin') {
      const admins = await pool.query("SELECT COUNT(*)::int AS count FROM users WHERE role='admin'");
      if (admins.rows[0].count <= 1) {
        return res.status(400).json({ error: 'At least one admin account must remain' });
      }
    }
    const result = await pool.query(
      'UPDATE users SET role=$1 WHERE id=$2 RETURNING id, username, role, created_at',
      [role, userId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update user role error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;