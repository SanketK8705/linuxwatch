const pool = require('../db');

const SUDO_WHITELIST = new Set(
  (process.env.SUDO_WHITELIST || 'ls,cat,cd,pwd,whoami,journalctl,systemctl,apt,apt-get,dnf,yum,docker,git,nano,vim,less,grep,tail,head,find,chmod,chown,cp,mv,mkdir,rm,echo,date,df,du,top,htop,ps,kill,su,sudo,psql,pg_dump,netfilter-persistent,iptables')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean)
);

const stores = {
  sshFails: {},
  portScan: {},
  sudoFails: {},
  ddos: {},
  sql: {},
  mitm: {},
  credentialStuffing: {},
};

function getStore(name, userId, key) {
  if (!stores[name][userId]) stores[name][userId] = {};
  if (!stores[name][userId][key]) stores[name][userId][key] = [];
  return stores[name][userId][key];
}

function setStore(name, userId, key, val) {
  stores[name][userId][key] = val;
}

function sanitizeEvent(event) {
  const trim = (v, max) => (v == null ? null : String(v).trim().slice(0, max));
  return {
    event_type: trim(event.event_type, 50),
    source_ip: trim(event.source_ip, 45),
    username: trim(event.username, 100),
    raw_log: trim(event.raw_log, 8000),
    port: event.port != null ? Number(event.port) : null,
    sudo_command: trim(event.sudo_command, 500),
    malware_type: trim(event.malware_type, 50),
    clicked: Boolean(event.clicked),
  };
}

async function fireAlert(io, userId, alert) {
  const result = await pool.query(
    `INSERT INTO alerts (user_id, rule_name, severity, source_ip, username, description, playbook_action, event_type)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [userId, alert.rule_name, alert.severity, alert.source_ip, alert.username, alert.description, alert.playbook_action, alert.event_type]
  );
  const row = result.rows[0];
  if (io) io.to(`user_${userId}`).emit('new_alert', row);
  console.log(`[ALERT] user=${userId} ${row.severity} - ${row.rule_name} from ${row.source_ip}`);
  return row;
}

function evaluateRules(userId, event) {
  const alerts = [];
  const now = Date.now();
  const { event_type, source_ip, username } = event;
  const ipKey = source_ip || 'unknown';

  // Brute-force: >5 failed SSH logins from same IP within 60s → CRITICAL
  if (event_type === 'SSH_FAILED_LOGIN') {
    const wins = getStore('sshFails', userId, ipKey).filter(t => now - t < 60000);
    wins.push(now);
    setStore('sshFails', userId, ipKey, wins);
    if (wins.length > 5) {
      alerts.push({
        rule_name: 'SSH_BRUTE_FORCE',
        severity: 'CRITICAL',
        source_ip, username,
        description: `${wins.length} SSH failures from ${source_ip} in 60 seconds`,
        playbook_action: 'BLOCK_IP',
      });
      setStore('sshFails', userId, ipKey, []);
    } else if (wins.length === 2) {
      alerts.push({
        rule_name: 'SSH_LOGIN_ATTEMPT',
        severity: 'LOW',
        source_ip, username,
        description: `Repeated SSH login attempt from ${source_ip}`,
        playbook_action: 'MONITOR',
      });
    }
  }

  // Port scan: >10 distinct ports from same IP within 30s → HIGH
  if (event_type === 'PORT_SCAN') {
    const key = `${userId}:${ipKey}`;
    if (!stores.portScan[key]) stores.portScan[key] = { ports: new Map(), events: [] };
    const bucket = stores.portScan[key];
    bucket.events = bucket.events.filter(t => now - t.time < 30000);
    bucket.events.push({ time: now, port: event.port ?? 'unknown' });
    if (event.port != null) bucket.ports.set(event.port, now);

    // prune old ports
    for (const [port, ts] of bucket.ports) {
      if (now - ts >= 30000) bucket.ports.delete(port);
    }

    const distinctPorts = bucket.ports.size || new Set(bucket.events.map(e => e.port)).size;
    const suppressed = bucket.suppressUntil && now < bucket.suppressUntil;
    if (distinctPorts > 10 && !suppressed) {
      alerts.push({
        rule_name: 'PORT_SCAN_DETECTED',
        severity: 'HIGH',
        source_ip, username: null,
        description: `Port scan from ${source_ip}: ${distinctPorts} distinct ports in 30s`,
        playbook_action: 'ALERT_ADMIN',
      });
      stores.portScan[key] = { ports: new Map(), events: [], suppressUntil: now + 300000 };
    } else if (distinctPorts >= 4 && !suppressed && now - (bucket.lastProbe || 0) > 60000) {
      bucket.lastProbe = now;
      alerts.push({
        rule_name: 'PORT_PROBE',
        severity: 'MEDIUM',
        source_ip, username: null,
        description: `Suspicious port probing from ${source_ip} (${distinctPorts} ports)`,
        playbook_action: 'MONITOR',
      });
    }
  }

  // Sudo abuse: command not in whitelist → HIGH
  if (event_type === 'SUDO_FAILURE' || event_type === 'SUDO_COMMAND') {
    const cmdParts = (event.sudo_command || '').trim().split(/\s+/);
    let cmdIdx = 0;
    while (cmdIdx < cmdParts.length && cmdParts[cmdIdx].startsWith('-')) {
      if (cmdParts[cmdIdx] === '-u' || cmdParts[cmdIdx] === '--user') cmdIdx += 1;
      cmdIdx += 1;
    }
    const cmd = cmdParts[cmdIdx]?.toLowerCase().split('/').pop();
    const notWhitelisted = cmd && !SUDO_WHITELIST.has(cmd);
    if (notWhitelisted || event_type === 'SUDO_FAILURE') {
      if (notWhitelisted) {
        alerts.push({
          rule_name: 'SUDO_ABUSE',
          severity: 'HIGH',
          source_ip, username,
          description: `Non-whitelisted sudo command "${event.sudo_command}" by ${username || 'unknown'}`,
          playbook_action: 'LOCK_USER',
        });
      } else {
        const isMultiFailLog = /3 incorrect password|incorrect password attempts|authentication failure|failed/i.test(event.raw_log || '');
        const wins = getStore('sudoFails', userId, username || ipKey).filter(t => now - t < 30000);
        wins.push(now);
        setStore('sudoFails', userId, username || ipKey, wins);
        if (wins.length >= 3 || isMultiFailLog) {
          alerts.push({
            rule_name: 'SUDO_ABUSE',
            severity: 'HIGH',
            source_ip, username,
            description: `User ${username || 'local'} failed sudo authentication (${isMultiFailLog ? '3 password attempts' : `${wins.length} times in 30s`})`,
            playbook_action: 'LOCK_USER',
          });
          setStore('sudoFails', userId, username || ipKey, []);
        }
      }
    }
  }

  // New/unrecognized SSH key → CRITICAL
  if (event_type === 'SSH_NEW_KEY') {
    alerts.push({
      rule_name: 'SSH_NEW_KEY',
      severity: 'CRITICAL',
      source_ip, username,
      description: `New SSH authorized key added${username ? ` for ${username}` : ''} from ${source_ip || 'local'}`,
      playbook_action: 'REVOKE_KEY',
    });
  }

  // ── Additional rules (simulator / agent attack types) ──
  if (event_type === 'HTTP_FLOOD') {
    const wins = getStore('ddos', userId, ipKey).filter(t => now - t < 5000);
    wins.push(now);
    setStore('ddos', userId, ipKey, wins);
    if (wins.length >= 25) {
      alerts.push({ rule_name: 'DDOS_ATTACK', severity: 'CRITICAL', source_ip, username: null, description: `DDoS flood from ${source_ip}: ${wins.length} req/5s`, playbook_action: 'RATE_LIMIT_IP' });
      setStore('ddos', userId, ipKey, []);
    } else if (wins.length === 12) {
      alerts.push({ rule_name: 'HIGH_REQUEST_RATE', severity: 'MEDIUM', source_ip, username: null, description: `Elevated request rate from ${source_ip}`, playbook_action: 'MONITOR' });
    }
  }

  if (event_type === 'SQL_INJECTION') {
    const wins = getStore('sql', userId, ipKey).filter(t => now - t < 60000);
    wins.push(now);
    setStore('sql', userId, ipKey, wins);
    if (wins.length === 1) {
      alerts.push({ rule_name: 'SQL_INJECTION_ATTEMPT', severity: 'HIGH', source_ip, username, description: `SQL injection from ${source_ip}`, playbook_action: 'BLOCK_REQUEST' });
    } else if (wins.length >= 3) {
      alerts.push({ rule_name: 'SQL_INJECTION_CAMPAIGN', severity: 'CRITICAL', source_ip, username, description: `SQL injection campaign from ${source_ip}`, playbook_action: 'BLOCK_IP' });
      setStore('sql', userId, ipKey, []);
    }
  }

  if (event_type === 'MITM_DETECTED') {
    const wins = getStore('mitm', userId, ipKey).filter(t => now - t < 120000);
    wins.push(now);
    setStore('mitm', userId, ipKey, wins);
    if (wins.length === 1) {
      alerts.push({ rule_name: 'MITM_ATTACK', severity: 'HIGH', source_ip, username, description: `MITM detected (attacker: ${source_ip})`, playbook_action: 'ISOLATE_SEGMENT' });
    } else if (wins.length >= 2) {
      alerts.push({ rule_name: 'MITM_PERSISTENT', severity: 'CRITICAL', source_ip, username, description: `Persistent MITM from ${source_ip}`, playbook_action: 'ISOLATE_SEGMENT' });
      setStore('mitm', userId, ipKey, []);
    }
  }

  if (event_type === 'MALWARE_DETECTED') {
    const isCritical = ['RANSOMWARE', 'ROOTKIT'].includes((event.malware_type || '').toUpperCase());
    alerts.push({
      rule_name: `MALWARE_${(event.malware_type || 'UNKNOWN').toUpperCase()}`,
      severity: isCritical ? 'CRITICAL' : 'HIGH',
      source_ip, username,
      description: `${event.malware_type || 'MALWARE'} detected on ${source_ip || 'host'}`,
      playbook_action: isCritical ? 'QUARANTINE_HOST' : 'RUN_ANTIVIRUS',
    });
  }

  if (event_type === 'PHISHING_ATTEMPT') {
    alerts.push({
      rule_name: 'PHISHING_ATTEMPT',
      severity: event.clicked ? 'HIGH' : 'MEDIUM',
      source_ip, username,
      description: event.clicked ? `User ${username} clicked phishing link` : `Phishing email targeting ${username}`,
      playbook_action: event.clicked ? 'RESET_CREDENTIALS' : 'QUARANTINE_EMAIL',
    });
  }

  if (event_type === 'CREDENTIAL_STUFFING') {
    const key = `${userId}:${ipKey}`;
    const bucket = stores.credentialStuffing[key] || { usernames: new Map(), events: [] };
    bucket.events = bucket.events.filter(timestamp => now - timestamp < 60000);
    bucket.events.push(now);
    if (username) bucket.usernames.set(username, now);
    for (const [name, timestamp] of bucket.usernames) {
      if (now - timestamp >= 60000) bucket.usernames.delete(name);
    }
    stores.credentialStuffing[key] = bucket;

    const distinctUsers = bucket.usernames.size;
    if (distinctUsers >= 5) {
      alerts.push({
        rule_name: 'CREDENTIAL_STUFFING',
        severity: 'HIGH',
        source_ip, username,
        description: `Credential stuffing from ${source_ip}: ${distinctUsers} usernames targeted in 60 seconds`,
        playbook_action: 'ENFORCE_MFA',
      });
      stores.credentialStuffing[key] = { usernames: new Map(), events: [] };
    }
  }

  return alerts;
}

async function ingestEvent(io, userId, rawEvent) {
  const event = sanitizeEvent(rawEvent);
  if (!event.event_type) throw new Error('event_type required');

  const pendingAlerts = evaluateRules(userId, event);

  const inserted = await pool.query(
    `INSERT INTO events (user_id, event_type, source_ip, username, raw_log)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [userId, event.event_type, event.source_ip, event.username, event.raw_log]
  );

  const fired = [];
  for (const alert of pendingAlerts) {
    fired.push(await fireAlert(io, userId, { ...alert, event_type: event.event_type }));
  }

  return { event: inserted.rows[0], alerts: fired, alert: fired[0] || null };
}

module.exports = { ingestEvent, evaluateRules, sanitizeEvent, SUDO_WHITELIST };
