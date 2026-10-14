const express = require('express');
const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { requireAnalystOrAdmin } = require('../middleware/role');
const { callLLM } = require('../engine/llm');

const SYSTEM_SUMMARIZE = `You are a SOC analyst assistant for LinuxWatch, a Linux SIEM/IDS.
Summarize the provided security events in plain English for an operator.
Be concise (3-6 sentences). Highlight critical patterns, affected hosts/IPs, and recommended next steps.
Do not invent events not present in the data.`;

const SYSTEM_ASK = `You are a SOC analyst assistant for LinuxWatch.
Answer the operator's question using ONLY the provided event context.
If the context is insufficient, say so. Be concise and actionable.`;

async function fetchEventContext(user, { limit = 50, source_ip, hours = 24 }) {
  const params = [hours];
  let query = `
    SELECT event_type, source_ip, username, raw_log, timestamp
    FROM events
    WHERE timestamp > NOW() - ($1 || ' hours')::interval`;
  if (user.role !== 'admin') {
    params.unshift(user.id);
    query = query.replace('WHERE ', 'WHERE user_id = $1 AND ').replace('$1 ||', '$2 ||');
  }
  if (source_ip) {
    params.push(source_ip);
    query += ` AND source_ip = $${params.length}`;
  }
  params.push(limit);
  query += ` ORDER BY timestamp DESC LIMIT $${params.length}`;

  const result = await pool.query(query, params);
  return result.rows;
}

function formatEventsForPrompt(events) {
  if (!events.length) return 'No events in the selected timeframe.';
  return events.map(e =>
    `[${new Date(e.timestamp).toISOString()}] ${e.event_type} ip=${e.source_ip || '—'} user=${e.username || '—'} log=${(e.raw_log || '').slice(0, 200)}`
  ).join('\n');
}

router.post('/summarize', authMiddleware, requireAnalystOrAdmin, validate('aiSummarize'), async (req, res) => {
  try {
    const { limit = 50, source_ip, hours = 24 } = req.body;
    const events = await fetchEventContext(req.user, { limit, source_ip, hours });
    const context = formatEventsForPrompt(events);

    const summary = await callLLM(
      SYSTEM_SUMMARIZE,
      `Recent events (${events.length} rows, last ${hours}h${source_ip ? `, filter IP ${source_ip}` : ''}):\n\n${context}`
    );

    res.json({ summary, eventCount: events.length });
  } catch (err) {
    console.error('AI summarize error:', err.message);
    const status = err.message.includes('AI_API_KEY') ? 503 : 500;
    res.status(status).json({ error: err.message || 'AI service error' });
  }
});

router.post('/ask', authMiddleware, requireAnalystOrAdmin, validate('aiAsk'), async (req, res) => {
  try {
    const { question, limit = 40, source_ip, hours = 24 } = req.body;
    const events = await fetchEventContext(req.user, { limit, source_ip, hours });
    const context = formatEventsForPrompt(events);

    const answer = await callLLM(
      SYSTEM_ASK,
      `Context (${events.length} events):\n${context}\n\nQuestion: ${question}`
    );

    res.json({ answer, eventCount: events.length });
  } catch (err) {
    console.error('AI ask error:', err.message);
    const status = err.message.includes('AI_API_KEY') ? 503 : 500;
    res.status(status).json({ error: err.message || 'AI service error' });
  }
});

module.exports = router;
