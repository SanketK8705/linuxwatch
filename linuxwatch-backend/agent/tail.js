/**
 * Node log tail agent — tails auth.log and POSTs parsed events to LinuxWatch.
 *
 * Usage:
 *   JWT_TOKEN=<token> node agent/tail.js
 *   JWT_TOKEN=<token> LOG_PATH=/var/log/auth.log BACKEND=http://localhost:5001 node agent/tail.js
 *
 * Or login to obtain token:
 *   SIM_USER=admin SIM_PASS=secret node agent/tail.js
 */

const fs = require('fs');
const http = require('http');

const BACKEND = process.env.BACKEND || 'http://localhost:5001';
const LOG_PATH = process.env.LOG_PATH || '/var/log/auth.log';
const TOKEN = process.env.JWT_TOKEN || '';
const SIM_USER = process.env.SIM_USER || '';
const SIM_PASS = process.env.SIM_PASS || '';

const RE_SSH_FAIL = /Failed password for (?:invalid user )?(\S+) from ([\d.a-fA-F:]+) port/;
const RE_SUDO_FAIL = /sudo:\s+(\S+)\s*:.*?(command not allowed|NOT in sudoers)/i;
const RE_SUDO_CMD = /sudo:\s+(\S+)\s*:.*COMMAND=(.+)$/i;
const RE_SSH_KEY = /(?:authorized_keys|Accepted publickey|Added new key)/i;
const RE_PORT = /connection (?:from|attempt) ([\d.a-fA-F:]+).*?port (\d+)/i;

async function login() {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ username: SIM_USER, password: SIM_PASS });
    const url = new URL(`${BACKEND}/api/auth/login`);
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.token) resolve(parsed.token);
          else reject(new Error('Login failed — no token'));
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function postEvent(token, event) {
  return new Promise(resolve => {
    const json = JSON.stringify(event);
    const url = new URL(`${BACKEND}/api/events`);
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(json),
        Authorization: `Bearer ${token}`,
      },
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const body = JSON.parse(data);
          console.log(`✓ ${event.event_type} alert=${body.alert?.rule_name || 'none'}`);
        } catch { console.log(`✓ ${event.event_type}`); }
        resolve();
      });
    });
    req.on('error', err => console.error('POST error:', err.message));
    req.write(json);
    req.end();
  });
}

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

async function main() {
  let token = TOKEN;
  if (!token && SIM_USER && SIM_PASS) {
    token = await login();
    console.log('Logged in as', SIM_USER);
  }
  if (!token) {
    console.error('Set JWT_TOKEN or SIM_USER+SIM_PASS');
    process.exit(1);
  }
  if (!fs.existsSync(LOG_PATH)) {
    console.error('Log file not found:', LOG_PATH);
    process.exit(1);
  }

  console.log('Tailing', LOG_PATH, '→', BACKEND);
  let fd = fs.openSync(LOG_PATH, 'r');
  fs.fstatSync(fd);
  fs.readSync(fd, Buffer.alloc(0), 0, 0, null);
  let pos = fs.fstatSync(fd).size;

  setInterval(() => {
    const stat = fs.fstatSync(fd);
    if (stat.size < pos) pos = 0;
    if (stat.size === pos) return;
    const buf = Buffer.alloc(stat.size - pos);
    fs.readSync(fd, buf, 0, buf.length, pos);
    pos = stat.size;
    buf.toString('utf8').split('\n').filter(Boolean).forEach(async line => {
      for (const ev of parseLine(line)) await postEvent(token, ev);
    });
  }, 500);
}

main().catch(err => { console.error(err); process.exit(1); });
