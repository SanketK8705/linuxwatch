/**
 * Unit tests for engine/detector.js
 *
 * These test the pure rule-evaluation logic (evaluateRules) and sanitizeEvent
 * without touching the database.  The in-memory stores inside detector.js
 * accumulate state between calls, which is exactly what we want for
 * window-based rules (brute-force, DDoS, etc.).
 */

const { evaluateRules, sanitizeEvent, SUDO_WHITELIST } = require('../../engine/detector');

// ── Helpers ────────────────────────────────────────────────────────────────

function makeEvent(overrides = {}) {
  return {
    event_type: 'SSH_FAILED_LOGIN',
    source_ip: '192.168.1.100',
    username: 'root',
    raw_log: 'test log',
    port: null,
    sudo_command: null,
    malware_type: null,
    clicked: false,
    ...overrides,
  };
}

/** Unique user ID per test to avoid cross-test store pollution */
let uid = 1000;
function freshUser() { return uid++; }

// ── sanitizeEvent ──────────────────────────────────────────────────────────

describe('sanitizeEvent', () => {
  test('trims and caps string fields', () => {
    const long = 'A'.repeat(200);
    const result = sanitizeEvent({ event_type: long, source_ip: long, username: long, raw_log: 'x'.repeat(10000) });
    expect(result.event_type.length).toBe(50);
    expect(result.source_ip.length).toBe(45);
    expect(result.username.length).toBe(100);
    expect(result.raw_log.length).toBe(8000);
  });

  test('converts port to number', () => {
    expect(sanitizeEvent({ event_type: 'x', port: '443' }).port).toBe(443);
  });

  test('handles null/undefined gracefully', () => {
    const result = sanitizeEvent({ event_type: 'x' });
    expect(result.source_ip).toBeNull();
    expect(result.username).toBeNull();
    expect(result.raw_log).toBeNull();
    expect(result.port).toBeNull();
    expect(result.clicked).toBe(false);
  });

  test('normalizes boolean clicked field', () => {
    expect(sanitizeEvent({ event_type: 'x', clicked: 'yes' }).clicked).toBe(true);
    expect(sanitizeEvent({ event_type: 'x', clicked: 0 }).clicked).toBe(false);
    expect(sanitizeEvent({ event_type: 'x', clicked: true }).clicked).toBe(true);
  });
});

// ── SSH Rules ──────────────────────────────────────────────────────────────

describe('SSH rules', () => {
  test('first SSH_FAILED_LOGIN produces no alert', () => {
    const userId = freshUser();
    const alerts = evaluateRules(userId, makeEvent());
    expect(alerts).toHaveLength(0);
  });

  test('2nd SSH failure triggers SSH_LOGIN_ATTEMPT (LOW)', () => {
    const userId = freshUser();
    evaluateRules(userId, makeEvent());
    const alerts = evaluateRules(userId, makeEvent());
    expect(alerts).toHaveLength(1);
    expect(alerts[0].rule_name).toBe('SSH_LOGIN_ATTEMPT');
    expect(alerts[0].severity).toBe('LOW');
    expect(alerts[0].playbook_action).toBe('MONITOR');
  });

  test('>5 failures in 60s triggers SSH_BRUTE_FORCE (CRITICAL)', () => {
    const userId = freshUser();
    const ip = '10.10.10.10';
    const allAlerts = [];
    for (let i = 0; i < 7; i++) {
      allAlerts.push(...evaluateRules(userId, makeEvent({ source_ip: ip })));
    }
    const brute = allAlerts.find(a => a.rule_name === 'SSH_BRUTE_FORCE');
    expect(brute).toBeDefined();
    expect(brute.severity).toBe('CRITICAL');
    expect(brute.playbook_action).toBe('BLOCK_IP');
  });

  test('SSH_NEW_KEY always fires CRITICAL alert', () => {
    const userId = freshUser();
    const alerts = evaluateRules(userId, makeEvent({ event_type: 'SSH_NEW_KEY', source_ip: '1.2.3.4', username: 'deploy' }));
    expect(alerts).toHaveLength(1);
    expect(alerts[0].rule_name).toBe('SSH_NEW_KEY');
    expect(alerts[0].severity).toBe('CRITICAL');
    expect(alerts[0].playbook_action).toBe('REVOKE_KEY');
    expect(alerts[0].description).toContain('deploy');
  });
});

// ── Port Scan Rules ────────────────────────────────────────────────────────

describe('Port scan rules', () => {
  test('4 distinct ports trigger PORT_PROBE (MEDIUM)', () => {
    const userId = freshUser();
    const ip = '172.16.0.1';
    let alerts;
    for (let i = 1; i <= 4; i++) {
      alerts = evaluateRules(userId, makeEvent({ event_type: 'PORT_SCAN', source_ip: ip, port: 2000 + i }));
    }
    const probe = alerts.find(a => a.rule_name === 'PORT_PROBE');
    expect(probe).toBeDefined();
    expect(probe.severity).toBe('MEDIUM');
  });

  test('>10 distinct ports trigger PORT_SCAN_DETECTED (HIGH)', () => {
    const userId = freshUser();
    const ip = '172.16.0.2';
    let alerts;
    for (let i = 1; i <= 11; i++) {
      alerts = evaluateRules(userId, makeEvent({ event_type: 'PORT_SCAN', source_ip: ip, port: 3000 + i }));
    }
    const scan = alerts.find(a => a.rule_name === 'PORT_SCAN_DETECTED');
    expect(scan).toBeDefined();
    expect(scan.severity).toBe('HIGH');
    expect(scan.playbook_action).toBe('ALERT_ADMIN');
  });
});

// ── Sudo Rules ─────────────────────────────────────────────────────────────

describe('Sudo rules', () => {
  test('SUDO_WHITELIST contains common commands', () => {
    expect(SUDO_WHITELIST.has('ls')).toBe(true);
    expect(SUDO_WHITELIST.has('apt')).toBe(true);
    expect(SUDO_WHITELIST.has('docker')).toBe(true);
    expect(SUDO_WHITELIST.has('cat')).toBe(true);
  });

  test('non-whitelisted sudo command fires SUDO_ABUSE (HIGH)', () => {
    const userId = freshUser();
    const alerts = evaluateRules(userId, makeEvent({
      event_type: 'SUDO_COMMAND',
      username: 'jdoe',
      sudo_command: 'nc -l -p 4444',
    }));
    expect(alerts).toHaveLength(1);
    expect(alerts[0].rule_name).toBe('SUDO_ABUSE');
    expect(alerts[0].severity).toBe('HIGH');
    expect(alerts[0].playbook_action).toBe('LOCK_USER');
  });

  test('whitelisted sudo command produces no alert', () => {
    const userId = freshUser();
    const alerts = evaluateRules(userId, makeEvent({
      event_type: 'SUDO_COMMAND',
      username: 'admin',
      sudo_command: 'apt update',
    }));
    expect(alerts).toHaveLength(0);
  });

  test('3 SUDO_FAILURE within 30s fires SUDO_ABUSE (HIGH)', () => {
    const userId = freshUser();
    let alerts;
    for (let i = 0; i < 3; i++) {
      alerts = evaluateRules(userId, makeEvent({
        event_type: 'SUDO_FAILURE',
        username: 'baduser',
      }));
    }
    const abuse = alerts.find(a => a.rule_name === 'SUDO_ABUSE');
    expect(abuse).toBeDefined();
    expect(abuse.severity).toBe('HIGH');
    expect(abuse.description).toContain('baduser');
  });
});

// ── DDoS / HTTP Flood Rules ───────────────────────────────────────────────

describe('DDoS / HTTP flood rules', () => {
  test('12th HTTP_FLOOD triggers HIGH_REQUEST_RATE (MEDIUM)', () => {
    const userId = freshUser();
    const ip = '203.0.113.1';
    let alerts;
    for (let i = 1; i <= 12; i++) {
      alerts = evaluateRules(userId, makeEvent({ event_type: 'HTTP_FLOOD', source_ip: ip }));
    }
    const rate = alerts.find(a => a.rule_name === 'HIGH_REQUEST_RATE');
    expect(rate).toBeDefined();
    expect(rate.severity).toBe('MEDIUM');
  });

  test('25th HTTP_FLOOD triggers DDOS_ATTACK (CRITICAL)', () => {
    const userId = freshUser();
    const ip = '203.0.113.2';
    let alerts;
    for (let i = 1; i <= 25; i++) {
      alerts = evaluateRules(userId, makeEvent({ event_type: 'HTTP_FLOOD', source_ip: ip }));
    }
    const ddos = alerts.find(a => a.rule_name === 'DDOS_ATTACK');
    expect(ddos).toBeDefined();
    expect(ddos.severity).toBe('CRITICAL');
    expect(ddos.playbook_action).toBe('RATE_LIMIT_IP');
  });
});

// ── SQL Injection Rules ───────────────────────────────────────────────────

describe('SQL injection rules', () => {
  test('1st SQL_INJECTION triggers SQL_INJECTION_ATTEMPT (HIGH)', () => {
    const userId = freshUser();
    const alerts = evaluateRules(userId, makeEvent({
      event_type: 'SQL_INJECTION',
      source_ip: '172.16.0.44',
      username: 'anon',
    }));
    expect(alerts).toHaveLength(1);
    expect(alerts[0].rule_name).toBe('SQL_INJECTION_ATTEMPT');
    expect(alerts[0].severity).toBe('HIGH');
    expect(alerts[0].playbook_action).toBe('BLOCK_REQUEST');
  });

  test('3rd SQL_INJECTION triggers SQL_INJECTION_CAMPAIGN (CRITICAL)', () => {
    const userId = freshUser();
    const ip = '172.16.0.45';
    let alerts;
    for (let i = 0; i < 3; i++) {
      alerts = evaluateRules(userId, makeEvent({ event_type: 'SQL_INJECTION', source_ip: ip }));
    }
    const campaign = alerts.find(a => a.rule_name === 'SQL_INJECTION_CAMPAIGN');
    expect(campaign).toBeDefined();
    expect(campaign.severity).toBe('CRITICAL');
    expect(campaign.playbook_action).toBe('BLOCK_IP');
  });
});

// ── MITM Rules ────────────────────────────────────────────────────────────

describe('MITM rules', () => {
  test('1st MITM_DETECTED triggers MITM_ATTACK (HIGH)', () => {
    const userId = freshUser();
    const alerts = evaluateRules(userId, makeEvent({ event_type: 'MITM_DETECTED', source_ip: '192.168.1.77' }));
    expect(alerts).toHaveLength(1);
    expect(alerts[0].rule_name).toBe('MITM_ATTACK');
    expect(alerts[0].severity).toBe('HIGH');
    expect(alerts[0].playbook_action).toBe('ISOLATE_SEGMENT');
  });

  test('2nd MITM_DETECTED triggers MITM_PERSISTENT (CRITICAL)', () => {
    const userId = freshUser();
    const ip = '192.168.1.78';
    evaluateRules(userId, makeEvent({ event_type: 'MITM_DETECTED', source_ip: ip }));
    const alerts = evaluateRules(userId, makeEvent({ event_type: 'MITM_DETECTED', source_ip: ip }));
    const persistent = alerts.find(a => a.rule_name === 'MITM_PERSISTENT');
    expect(persistent).toBeDefined();
    expect(persistent.severity).toBe('CRITICAL');
  });
});

// ── Malware Rules ─────────────────────────────────────────────────────────

describe('Malware rules', () => {
  test('RANSOMWARE triggers CRITICAL malware alert', () => {
    const userId = freshUser();
    const alerts = evaluateRules(userId, makeEvent({
      event_type: 'MALWARE_DETECTED',
      malware_type: 'RANSOMWARE',
      source_ip: '10.0.0.5',
    }));
    expect(alerts).toHaveLength(1);
    expect(alerts[0].severity).toBe('CRITICAL');
    expect(alerts[0].rule_name).toBe('MALWARE_RANSOMWARE');
    expect(alerts[0].playbook_action).toBe('QUARANTINE_HOST');
  });

  test('ROOTKIT triggers CRITICAL malware alert', () => {
    const userId = freshUser();
    const alerts = evaluateRules(userId, makeEvent({
      event_type: 'MALWARE_DETECTED',
      malware_type: 'ROOTKIT',
    }));
    expect(alerts[0].severity).toBe('CRITICAL');
    expect(alerts[0].playbook_action).toBe('QUARANTINE_HOST');
  });

  test('SPYWARE triggers HIGH malware alert', () => {
    const userId = freshUser();
    const alerts = evaluateRules(userId, makeEvent({
      event_type: 'MALWARE_DETECTED',
      malware_type: 'SPYWARE',
    }));
    expect(alerts[0].severity).toBe('HIGH');
    expect(alerts[0].playbook_action).toBe('RUN_ANTIVIRUS');
  });

  test('unknown malware type triggers HIGH alert', () => {
    const userId = freshUser();
    const alerts = evaluateRules(userId, makeEvent({
      event_type: 'MALWARE_DETECTED',
      malware_type: null,
    }));
    expect(alerts[0].severity).toBe('HIGH');
    expect(alerts[0].rule_name).toBe('MALWARE_UNKNOWN');
  });
});

// ── Phishing Rules ────────────────────────────────────────────────────────

describe('Phishing rules', () => {
  test('phishing not clicked triggers MEDIUM alert', () => {
    const userId = freshUser();
    const alerts = evaluateRules(userId, makeEvent({
      event_type: 'PHISHING_ATTEMPT',
      username: 'alice',
      clicked: false,
    }));
    expect(alerts).toHaveLength(1);
    expect(alerts[0].rule_name).toBe('PHISHING_ATTEMPT');
    expect(alerts[0].severity).toBe('MEDIUM');
    expect(alerts[0].playbook_action).toBe('QUARANTINE_EMAIL');
  });

  test('phishing clicked triggers HIGH alert', () => {
    const userId = freshUser();
    const alerts = evaluateRules(userId, makeEvent({
      event_type: 'PHISHING_ATTEMPT',
      username: 'bob',
      clicked: true,
    }));
    expect(alerts[0].severity).toBe('HIGH');
    expect(alerts[0].playbook_action).toBe('RESET_CREDENTIALS');
    expect(alerts[0].description).toContain('bob');
  });
});

// ── Credential Stuffing ───────────────────────────────────────────────────

describe('Credential stuffing rule', () => {
  test('five distinct usernames from one IP within 60s fire HIGH alert', () => {
    const userId = freshUser();
    const alertsBeforeThreshold = [];
    for (const username of ['admin', 'alice', 'bob', 'carol']) {
      alertsBeforeThreshold.push(...evaluateRules(userId, makeEvent({
        event_type: 'CREDENTIAL_STUFFING',
        source_ip: '45.33.32.156',
        username,
      })));
    }
    expect(alertsBeforeThreshold).toHaveLength(0);

    const alerts = evaluateRules(userId, makeEvent({
      event_type: 'CREDENTIAL_STUFFING',
      source_ip: '45.33.33.156',
      username: 'dave',
    }));
    // A different source IP must not inherit the first bucket.
    expect(alerts).toHaveLength(0);

    const thresholdAlerts = evaluateRules(userId, makeEvent({
      event_type: 'CREDENTIAL_STUFFING',
      source_ip: '45.33.32.156',
      username: 'dave',
    }));
    expect(thresholdAlerts).toHaveLength(1);
    expect(thresholdAlerts[0].rule_name).toBe('CREDENTIAL_STUFFING');
    expect(thresholdAlerts[0].severity).toBe('HIGH');
    expect(thresholdAlerts[0].playbook_action).toBe('ENFORCE_MFA');
  });

  test('repeated username does not count as a distinct credential', () => {
    const userId = freshUser();
    for (let i = 0; i < 4; i++) {
      expect(evaluateRules(userId, makeEvent({
        event_type: 'CREDENTIAL_STUFFING',
        source_ip: '45.33.34.156',
        username: 'same-user',
      }))).toHaveLength(0);
    }
    const alerts = evaluateRules(userId, makeEvent({
      event_type: 'CREDENTIAL_STUFFING',
      source_ip: '45.33.34.156',
      username: 'another-user',
    }));
    expect(alerts).toHaveLength(0);
    for (const username of ['third-user', 'fourth-user']) {
      expect(evaluateRules(userId, makeEvent({
        event_type: 'CREDENTIAL_STUFFING',
        source_ip: '45.33.34.156',
        username,
      }))).toHaveLength(0);
    }
    const thresholdAlerts = evaluateRules(userId, makeEvent({
      event_type: 'CREDENTIAL_STUFFING',
      source_ip: '45.33.34.156',
      username: 'fifth-user',
    }));
    expect(thresholdAlerts).toHaveLength(1);
    expect(thresholdAlerts[0].rule_name).toBe('CREDENTIAL_STUFFING');
    expect(thresholdAlerts[0].severity).toBe('HIGH');
    expect(thresholdAlerts[0].playbook_action).toBe('ENFORCE_MFA');
  });
});

// ── Unknown event types ───────────────────────────────────────────────────

describe('Unknown event types', () => {
  test('unrecognized event_type produces no alerts', () => {
    const userId = freshUser();
    const alerts = evaluateRules(userId, makeEvent({ event_type: 'SOME_RANDOM_EVENT' }));
    expect(alerts).toHaveLength(0);
  });
});
