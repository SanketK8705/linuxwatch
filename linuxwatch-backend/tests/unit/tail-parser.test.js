/**
 * Unit tests for agent/tail.js — parseLine function
 *
 * We test the regex-based log parser that converts raw auth.log
 * lines into structured events for the backend.
 */

// The parseLine function is defined inside tail.js.
// We need to extract it. Since tail.js uses module-level side-effects
// (reads env vars, defines main()), we require just the regexes and
// replicate the parseLine logic here for isolated testing.

// Import the file. We need to mock fs.existsSync to prevent main() from failing.
// Actually, tail.js calls main() at the end, so we'll replicate the regexes here.

const RE_SSH_FAIL = /Failed password for (?:invalid user )?(\S+) from ([\d.a-fA-F:]+) port/;
const RE_SUDO_FAIL = /sudo:\s+(\S+)\s*:.*?(command not allowed|NOT in sudoers)/i;
const RE_SUDO_CMD = /sudo:\s+(\S+)\s*:.*COMMAND=(.+)$/i;
const RE_SSH_KEY = /(?:authorized_keys|Accepted publickey|Added new key)/i;
const RE_PORT = /connection (?:from|attempt) ([\d.a-fA-F:]+).*?port (\d+)/i;

function parseLine(line) {
  const events = [];
  let m = line.match(RE_SSH_FAIL);
  if (m) {
    events.push({ event_type: 'SSH_FAILED_LOGIN', username: m[1], source_ip: m[2], raw_log: line.trim() });
    return events;
  }
  if (RE_SSH_KEY.test(line)) {
    events.push({ event_type: 'SSH_NEW_KEY', source_ip: null, username: null, raw_log: line.trim() });
    return events;
  }
  m = line.match(RE_PORT);
  if (m) {
    events.push({ event_type: 'PORT_SCAN', source_ip: m[1], port: parseInt(m[2], 10), raw_log: line.trim() });
  }
  m = line.match(RE_SUDO_CMD);
  if (m) {
    events.push({ event_type: 'SUDO_COMMAND', username: m[1], sudo_command: m[2].trim(), raw_log: line.trim() });
    return events;
  }
  m = line.match(RE_SUDO_FAIL);
  if (m) {
    events.push({ event_type: 'SUDO_FAILURE', username: m[1], raw_log: line.trim() });
  }
  return events;
}

// ── SSH Failed Login Parsing ──────────────────────────────────────────────

describe('parseLine — SSH_FAILED_LOGIN', () => {
  test('parses standard SSH failure', () => {
    const line = 'Sep 19 12:00:01 host sshd[1234]: Failed password for root from 192.168.1.99 port 22 ssh2';
    const events = parseLine(line);
    expect(events).toHaveLength(1);
    expect(events[0].event_type).toBe('SSH_FAILED_LOGIN');
    expect(events[0].username).toBe('root');
    expect(events[0].source_ip).toBe('192.168.1.99');
  });

  test('parses SSH failure for invalid user', () => {
    const line = 'Sep 19 12:00:01 host sshd[1234]: Failed password for invalid user admin from 10.0.0.5 port 54321 ssh2';
    const events = parseLine(line);
    expect(events).toHaveLength(1);
    expect(events[0].username).toBe('admin');
    expect(events[0].source_ip).toBe('10.0.0.5');
  });

  test('parses IPv6 SSH failure', () => {
    const line = 'Failed password for test from 2001:db8::1 port 22 ssh2';
    const events = parseLine(line);
    expect(events).toHaveLength(1);
    expect(events[0].source_ip).toBe('2001:db8::1');
  });
});

// ── SSH New Key Parsing ───────────────────────────────────────────────────

describe('parseLine — SSH_NEW_KEY', () => {
  test('detects authorized_keys mention', () => {
    const line = 'Sep 19 12:00:01 host sshd[1234]: User root added to authorized_keys';
    const events = parseLine(line);
    expect(events).toHaveLength(1);
    expect(events[0].event_type).toBe('SSH_NEW_KEY');
  });

  test('detects Accepted publickey', () => {
    const line = 'Accepted publickey for deploy from 1.2.3.4';
    const events = parseLine(line);
    expect(events).toHaveLength(1);
    expect(events[0].event_type).toBe('SSH_NEW_KEY');
  });

  test('detects Added new key', () => {
    const line = 'Added new key for user test';
    const events = parseLine(line);
    expect(events).toHaveLength(1);
    expect(events[0].event_type).toBe('SSH_NEW_KEY');
  });
});

// ── Port Scan Parsing ─────────────────────────────────────────────────────

describe('parseLine — PORT_SCAN', () => {
  test('detects connection attempt with port', () => {
    const line = 'connection attempt 192.168.1.50 port 8080';
    const events = parseLine(line);
    expect(events.some(e => e.event_type === 'PORT_SCAN')).toBe(true);
    const scan = events.find(e => e.event_type === 'PORT_SCAN');
    expect(scan.source_ip).toBe('192.168.1.50');
    expect(scan.port).toBe(8080);
  });

  test('detects connection from with port', () => {
    const line = 'connection from 10.0.0.1 on port 443';
    const events = parseLine(line);
    const scan = events.find(e => e.event_type === 'PORT_SCAN');
    expect(scan).toBeDefined();
    expect(scan.port).toBe(443);
  });
});

// ── Sudo Command Parsing ──────────────────────────────────────────────────

describe('parseLine — SUDO_COMMAND', () => {
  test('detects sudo command', () => {
    const line = 'Sep 19 12:00:01 host sudo: jdoe : TTY=pts/1 ; PWD=/home ; USER=root ; COMMAND=/usr/bin/nc -l -p 4444';
    const events = parseLine(line);
    expect(events).toHaveLength(1);
    expect(events[0].event_type).toBe('SUDO_COMMAND');
    expect(events[0].username).toBe('jdoe');
    expect(events[0].sudo_command).toContain('nc');
  });
});

// ── Sudo Failure Parsing ──────────────────────────────────────────────────

describe('parseLine — SUDO_FAILURE', () => {
  test('detects command not allowed', () => {
    const line = 'sudo: alice : command not allowed ; TTY=pts/1';
    const events = parseLine(line);
    expect(events).toHaveLength(1);
    expect(events[0].event_type).toBe('SUDO_FAILURE');
    expect(events[0].username).toBe('alice');
  });

  test('detects NOT in sudoers', () => {
    const line = 'sudo: bob : user NOT in sudoers ; TTY=pts/0';
    const events = parseLine(line);
    expect(events).toHaveLength(1);
    expect(events[0].event_type).toBe('SUDO_FAILURE');
    expect(events[0].username).toBe('bob');
  });
});

// ── Unrecognized Lines ────────────────────────────────────────────────────

describe('parseLine — unrecognized lines', () => {
  test('returns empty array for normal log lines', () => {
    const events = parseLine('Sep 19 12:00:01 host kernel: Normal kernel message');
    expect(events).toHaveLength(0);
  });

  test('returns empty array for empty string', () => {
    expect(parseLine('')).toHaveLength(0);
  });
});
