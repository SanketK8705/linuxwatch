const pool = require('../db');

// Per-user sliding windows: windows[userId][ip_or_user] = [timestamps]
const ipWindows     = {};
const portScanWins  = {};
const sudoWins      = {};
const ddosWins      = {};
const sqlWins       = {};
const mitWins       = {};
const malwareWins   = {};
const phishingWins  = {};

function getWindow(store, userId, key) {
  if (!store[userId]) store[userId] = {};
  if (!store[userId][key]) store[userId][key] = [];
  return store[userId][key];
}

function setWindow(store, userId, key, val) {
  store[userId][key] = val;
}

async function fireAlert(io, userId, { rule_name, severity, source_ip, username, description, playbook_action }) {
  const result = await pool.query(
    `INSERT INTO alerts (user_id, rule_name, severity, source_ip, username, description, playbook_action)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [userId, rule_name, severity, source_ip, username, description, playbook_action]
  );
  const alert = result.rows[0];
  // Emit only to the socket room for this user
  if (io) io.to(`user_${userId}`).emit('new_alert', alert);
  console.log(`[ALERT] user=${userId} ${severity} - ${rule_name} from ${source_ip}`);
  return alert;
}

async function processEvent(io, userId, event) {
  const { event_type, source_ip, username } = event;
  const now = Date.now();

  // ── Rule 1: SSH Brute Force — 5 failures in 60s → CRITICAL
  if (event_type === 'SSH_FAILED_LOGIN') {
    const wins = getWindow(ipWindows, userId, source_ip);
    const fresh = wins.filter(t => now - t < 60000);
    fresh.push(now);
    setWindow(ipWindows, userId, source_ip, fresh);
    if (fresh.length === 5) {
      await fireAlert(io, userId, {
        rule_name: 'SSH_BRUTE_FORCE',
        severity: 'CRITICAL',
        source_ip, username,
        description: `5 SSH failures from ${source_ip} in 60 seconds`,
        playbook_action: 'BLOCK_IP',
      });
      setWindow(ipWindows, userId, source_ip, []);
    } else if (fresh.length === 2) {
      // LOW alert on early signs
      await fireAlert(io, userId, {
        rule_name: 'SSH_LOGIN_ATTEMPT',
        severity: 'LOW',
        source_ip, username,
        description: `Repeated SSH login attempt from ${source_ip}`,
        playbook_action: 'MONITOR',
      });
    }
  }

  // ── Rule 2: Port Scan — 10 events in 10s → HIGH
  if (event_type === 'PORT_SCAN') {
    const wins = getWindow(portScanWins, userId, source_ip);
    const fresh = wins.filter(t => now - t < 10000);
    fresh.push(now);
    setWindow(portScanWins, userId, source_ip, fresh);
    if (fresh.length >= 10) {
      await fireAlert(io, userId, {
        rule_name: 'PORT_SCAN_DETECTED',
        severity: 'HIGH',
        source_ip, username: null,
        description: `Port scan detected from ${source_ip} (${fresh.length} probes in 10s)`,
        playbook_action: 'ALERT_ADMIN',
      });
      setWindow(portScanWins, userId, source_ip, []);
    } else if (fresh.length === 4) {
      await fireAlert(io, userId, {
        rule_name: 'PORT_PROBE',
        severity: 'MEDIUM',
        source_ip, username: null,
        description: `Suspicious port probing from ${source_ip}`,
        playbook_action: 'MONITOR',
      });
    }
  }

  // ── Rule 3: Sudo Abuse — 3 failures in 30s → HIGH
  if (event_type === 'SUDO_FAILURE') {
    const wins = getWindow(sudoWins, userId, username || source_ip);
    const fresh = wins.filter(t => now - t < 30000);
    fresh.push(now);
    setWindow(sudoWins, userId, username || source_ip, fresh);
    if (fresh.length >= 3) {
      await fireAlert(io, userId, {
        rule_name: 'SUDO_ABUSE',
        severity: 'HIGH',
        source_ip, username,
        description: `User ${username} failed sudo ${fresh.length} times in 30 seconds`,
        playbook_action: 'LOCK_USER',
      });
      setWindow(sudoWins, userId, username || source_ip, []);
    }
  }

  // ── Rule 4: DDoS — 20 requests in 5s → CRITICAL
  if (event_type === 'HTTP_FLOOD') {
    const wins = getWindow(ddosWins, userId, source_ip);
    const fresh = wins.filter(t => now - t < 5000);
    fresh.push(now);
    setWindow(ddosWins, userId, source_ip, fresh);
    if (fresh.length >= 20) {
      await fireAlert(io, userId, {
        rule_name: 'DDOS_ATTACK',
        severity: 'CRITICAL',
        source_ip, username: null,
        description: `DDoS flood from ${source_ip}: ${fresh.length} requests in 5 seconds`,
        playbook_action: 'RATE_LIMIT_IP',
      });
      setWindow(ddosWins, userId, source_ip, []);
    } else if (fresh.length === 8) {
      await fireAlert(io, userId, {
        rule_name: 'HIGH_REQUEST_RATE',
        severity: 'MEDIUM',
        source_ip, username: null,
        description: `Elevated request rate from ${source_ip}`,
        playbook_action: 'MONITOR',
      });
    }
  }

  // ── Rule 5: SQL Injection — any single event → HIGH; repeated → CRITICAL
  if (event_type === 'SQL_INJECTION') {
    const wins = getWindow(sqlWins, userId, source_ip);
    const fresh = wins.filter(t => now - t < 60000);
    fresh.push(now);
    setWindow(sqlWins, userId, source_ip, fresh);
    if (fresh.length === 1) {
      await fireAlert(io, userId, {
        rule_name: 'SQL_INJECTION_ATTEMPT',
        severity: 'HIGH',
        source_ip, username,
        description: `SQL injection pattern detected from ${source_ip}`,
        playbook_action: 'BLOCK_REQUEST',
      });
    } else if (fresh.length >= 3) {
      await fireAlert(io, userId, {
        rule_name: 'SQL_INJECTION_CAMPAIGN',
        severity: 'CRITICAL',
        source_ip, username,
        description: `Sustained SQL injection campaign from ${source_ip} (${fresh.length} attempts)`,
        playbook_action: 'BLOCK_IP',
      });
      setWindow(sqlWins, userId, source_ip, []);
    }
  }

  // ── Rule 6: MITM — single event is already HIGH
  if (event_type === 'MITM_DETECTED') {
    const wins = getWindow(mitWins, userId, source_ip);
    const fresh = wins.filter(t => now - t < 120000);
    fresh.push(now);
    setWindow(mitWins, userId, source_ip, fresh);
    if (fresh.length === 1) {
      await fireAlert(io, userId, {
        rule_name: 'MITM_ATTACK',
        severity: 'HIGH',
        source_ip, username,
        description: `Man-in-the-middle attack detected on network segment (attacker: ${source_ip})`,
        playbook_action: 'ISOLATE_SEGMENT',
      });
    } else if (fresh.length >= 2) {
      await fireAlert(io, userId, {
        rule_name: 'MITM_PERSISTENT',
        severity: 'CRITICAL',
        source_ip, username,
        description: `Persistent MITM activity from ${source_ip} — possible ARP poisoning`,
        playbook_action: 'ISOLATE_SEGMENT',
      });
      setWindow(mitWins, userId, source_ip, []);
    }
  }

  // ── Rule 7: Malware — ransomware/spyware → CRITICAL, generic malware → HIGH
  if (event_type === 'MALWARE_DETECTED') {
    const { malware_type = 'UNKNOWN' } = event;
    const isCritical = ['RANSOMWARE', 'ROOTKIT'].includes(malware_type);
    await fireAlert(io, userId, {
      rule_name: `MALWARE_${malware_type}`,
      severity: isCritical ? 'CRITICAL' : 'HIGH',
      source_ip, username,
      description: `${malware_type} detected on host ${source_ip} (user: ${username || 'unknown'})`,
      playbook_action: isCritical ? 'QUARANTINE_HOST' : 'RUN_ANTIVIRUS',
    });
  }

  // ── Rule 8: Phishing — single event → MEDIUM; if user clicked → HIGH
  if (event_type === 'PHISHING_ATTEMPT') {
    const { clicked = false } = event;
    await fireAlert(io, userId, {
      rule_name: 'PHISHING_ATTEMPT',
      severity: clicked ? 'HIGH' : 'MEDIUM',
      source_ip, username,
      description: clicked
        ? `User ${username} clicked a phishing link from ${source_ip}`
        : `Phishing email intercepted targeting ${username} from ${source_ip}`,
      playbook_action: clicked ? 'RESET_CREDENTIALS' : 'QUARANTINE_EMAIL',
    });
  }

  // ── Rule 9: Credential stuffing — 3 different usernames from same IP in 60s → HIGH
  if (event_type === 'CREDENTIAL_STUFFING') {
    await fireAlert(io, userId, {
      rule_name: 'CREDENTIAL_STUFFING',
      severity: 'HIGH',
      source_ip, username,
      description: `Credential stuffing detected from ${source_ip} — multiple accounts targeted`,
      playbook_action: 'ENFORCE_MFA',
    });
  }
}

module.exports = { processEvent };