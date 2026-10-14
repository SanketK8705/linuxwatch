/**
 * Unit tests for the Python agent's log parsers
 *
 * We replicate the Python regex patterns in JS and test them.
 * This validates that the regex logic documented in Agent.py
 * matches the expected event types.
 */

// Replicate the Python agent's regex patterns
const RE_SSH_FAIL = /Failed password for (?:invalid user )?(\S+) from ([\d.a-fA-F:]+) port/;
const RE_SSH_OK = /Accepted (?:password|publickey) for (\S+) from ([\d.a-fA-F:]+)/;
const RE_SUDO_CMD = /sudo:\s+(\S+)\s*:.*COMMAND=(.+)$/i;
const RE_SSH_NEW_KEY = /(?:authorized_keys|Accepted publickey|ssh-keygen|Added new key)/i;
const RE_CONN_ATTEMPT = /connection (?:from|attempt) ([\d.a-fA-F:]+).*?port (\d+)/i;
const RE_SUDO_FAIL = /sudo:\s+(\S+)\s*:.*?(command not allowed|NOT in sudoers|authentication failure)/i;

const MALWARE_KEYWORDS = [
  'ransomware', 'malware', 'trojan', 'rootkit', 'spyware',
  'cryptominer', 'miner', 'backdoor', 'keylogger',
];

const RE_SQL = /(?:union\s+select|or\s+1\s*=\s*1|drop\s+table|insert\s+into|sleep\s*\(|benchmark\s*\(|'--|xp_\w+)/i;

const RE_NGINX = /^([\d.a-fA-F:]+)\s+-\s+-\s+\[.*?\]\s+"(\S+)\s+(\S+)\s+\S+"\s+(\d+)/;

describe('Python Agent — SSH patterns', () => {
  test('RE_SSH_FAIL matches auth.log line', () => {
    const line = 'Failed password for root from 192.168.1.99 port 22 ssh2';
    const m = line.match(RE_SSH_FAIL);
    expect(m).not.toBeNull();
    expect(m[1]).toBe('root');
    expect(m[2]).toBe('192.168.1.99');
  });

  test('RE_SSH_FAIL matches invalid user', () => {
    const line = 'Failed password for invalid user admin from 10.0.0.5 port 54321 ssh2';
    const m = line.match(RE_SSH_FAIL);
    expect(m).not.toBeNull();
    expect(m[1]).toBe('admin');
  });

  test('RE_SSH_OK matches accepted password', () => {
    const line = 'Accepted password for deploy from 1.2.3.4 port 22 ssh2';
    const m = line.match(RE_SSH_OK);
    expect(m).not.toBeNull();
    expect(m[1]).toBe('deploy');
    expect(m[2]).toBe('1.2.3.4');
  });

  test('RE_SSH_NEW_KEY matches various key events', () => {
    expect(RE_SSH_NEW_KEY.test('Added new key for root')).toBe(true);
    expect(RE_SSH_NEW_KEY.test('authorized_keys modified')).toBe(true);
    expect(RE_SSH_NEW_KEY.test('Accepted publickey for user')).toBe(true);
    expect(RE_SSH_NEW_KEY.test('ssh-keygen executed')).toBe(true);
  });
});

describe('Python Agent — sudo patterns', () => {
  test('RE_SUDO_CMD matches sudo with COMMAND', () => {
    const line = 'sudo: jdoe : TTY=pts/1 ; COMMAND=/usr/bin/nc -l -p 4444';
    const m = line.match(RE_SUDO_CMD);
    expect(m).not.toBeNull();
    expect(m[1]).toBe('jdoe');
    expect(m[2]).toContain('nc');
  });

  test('RE_SUDO_FAIL matches command not allowed', () => {
    const line = 'sudo: alice : command not allowed ; TTY=pts/1';
    const m = line.match(RE_SUDO_FAIL);
    expect(m).not.toBeNull();
    expect(m[1]).toBe('alice');
  });

  test('RE_SUDO_FAIL matches NOT in sudoers', () => {
    const line = 'sudo: bob : user NOT in sudoers ; TTY=pts/0';
    const m = line.match(RE_SUDO_FAIL);
    expect(m).not.toBeNull();
    expect(m[1]).toBe('bob');
  });

  test('RE_SUDO_FAIL matches authentication failure', () => {
    const line = 'sudo: charlie : authentication failure ; TTY=pts/2';
    const m = line.match(RE_SUDO_FAIL);
    expect(m).not.toBeNull();
    expect(m[1]).toBe('charlie');
  });
});

describe('Python Agent — connection/port scan pattern', () => {
  test('RE_CONN_ATTEMPT matches connection from', () => {
    const line = 'connection from 10.0.0.1 on port 8080';
    const m = line.match(RE_CONN_ATTEMPT);
    expect(m).not.toBeNull();
    expect(m[1]).toBe('10.0.0.1');
    expect(m[2]).toBe('8080');
  });

  test('RE_CONN_ATTEMPT matches connection attempt', () => {
    const line = 'connection attempt 192.168.0.5 to port 443';
    const m = line.match(RE_CONN_ATTEMPT);
    expect(m).not.toBeNull();
    expect(m[1]).toBe('192.168.0.5');
    expect(m[2]).toBe('443');
  });
});

describe('Python Agent — malware keyword detection', () => {
  test('detects all malware keywords', () => {
    for (const kw of MALWARE_KEYWORDS) {
      const line = `Detected ${kw} activity on host`;
      expect(line.toLowerCase().includes(kw)).toBe(true);
    }
  });

  test('case-insensitive detection', () => {
    expect('RANSOMWARE detected!'.toLowerCase().includes('ransomware')).toBe(true);
    expect('Trojan horse found'.toLowerCase().includes('trojan')).toBe(true);
  });
});

describe('Python Agent — SQL injection detection', () => {
  test('detects OR 1=1', () => {
    expect(RE_SQL.test("id=1' OR 1=1")).toBe(true);
  });

  test('detects UNION SELECT', () => {
    expect(RE_SQL.test("id=1 UNION SELECT * FROM users")).toBe(true);
  });

  test('detects DROP TABLE', () => {
    expect(RE_SQL.test("'; DROP TABLE users; --")).toBe(true);
  });

  test('detects SLEEP()', () => {
    expect(RE_SQL.test("id=1; SLEEP(5)")).toBe(true);
  });

  test('does not match normal queries', () => {
    expect(RE_SQL.test("/api/users?page=1&limit=20")).toBe(false);
  });
});

describe('Python Agent — nginx log parsing', () => {
  test('RE_NGINX matches standard access log', () => {
    const line = '127.0.0.1 - - [01/Jan/2025:12:00:00 +0000] "GET /index.html HTTP/1.1" 200 512 "-" "curl"';
    const m = line.match(RE_NGINX);
    expect(m).not.toBeNull();
    expect(m[1]).toBe('127.0.0.1');
    expect(m[2]).toBe('GET');
    expect(m[3]).toBe('/index.html');
    expect(m[4]).toBe('200');
  });

  test('RE_NGINX handles POST requests', () => {
    const line = '10.0.0.1 - - [01/Jan/2025:12:00:00 +0000] "POST /api/login HTTP/1.1" 401 64 "-" "Mozilla"';
    const m = line.match(RE_NGINX);
    expect(m).not.toBeNull();
    expect(m[2]).toBe('POST');
    expect(m[4]).toBe('401');
  });

  test('RE_NGINX does not match non-standard lines', () => {
    const m = 'Just a random log line'.match(RE_NGINX);
    expect(m).toBeNull();
  });
});
