/**
 * simulate.js
 * Fires a realistic mix of attack events across all detection rules.
 *
 * Usage: JWT_TOKEN=<your_token> node simulate.js
 *  OR:  node simulate.js  (will prompt you to register/login first)
 */

const http = require('http');

const BACKEND = 'http://localhost:3001';
const TOKEN   = process.env.JWT_TOKEN || '';

if (!TOKEN) {
  console.error('❌  No JWT token found.');
  console.error('    Login via the frontend, open DevTools → Application → localStorage');
  console.error('    Copy the token, then run:');
  console.error('    JWT_TOKEN=<token> node simulate.js');
  process.exit(1);
}

function post(path, body) {
  return new Promise((resolve) => {
    const json = JSON.stringify(body);
    const opts = {
      hostname: 'localhost',
      port: 3001,
      path,
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Content-Length': Buffer.byteLength(json),
        'Authorization': `Bearer ${TOKEN}`,
      },
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: {} }); }
      });
    });
    req.on('error', err => { console.error('Request error:', err.message); resolve({}); });
    req.write(json);
    req.end();
  });
}

async function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function run() {
  console.log('🚀  LinuxWatch Attack Simulator\n');

  // ── 1. SSH Brute Force (5 rapid → CRITICAL, first 2 also fire LOW)
  console.log('── SSH Brute Force ──');
  for (let i = 1; i <= 7; i++) {
    const r = await post('/api/events', {
      event_type: 'SSH_FAILED_LOGIN',
      source_ip: '192.168.1.99',
      username: 'root',
      raw_log: `Failed password for root from 192.168.1.99 port 22 ssh2`,
    });
    console.log(`  [SSH ${i}/7] status=${r.status} alert=${r.body?.alert?.rule_name || 'none'}`);
    await delay(400);
  }

  await delay(800);

  // ── 2. Port Scan (12 rapid probes → MEDIUM at 4, HIGH at 10)
  console.log('\n── Port Scan ──');
  for (let i = 1; i <= 12; i++) {
    const r = await post('/api/events', {
      event_type: 'PORT_SCAN',
      source_ip: '10.0.0.55',
      raw_log: `Nmap scan from 10.0.0.55 port ${1000 + i}`,
    });
    console.log(`  [SCAN ${i}/12] status=${r.status} alert=${r.body?.alert?.rule_name || 'none'}`);
    await delay(200);
  }

  await delay(800);

  // ── 3. Sudo Abuse (3 failures → HIGH)
  console.log('\n── Sudo Abuse ──');
  for (let i = 1; i <= 3; i++) {
    const r = await post('/api/events', {
      event_type: 'SUDO_FAILURE',
      source_ip: '192.168.1.20',
      username: 'jdoe',
      raw_log: `sudo: jdoe : command not allowed ; TTY=pts/1`,
    });
    console.log(`  [SUDO ${i}/3] status=${r.status} alert=${r.body?.alert?.rule_name || 'none'}`);
    await delay(400);
  }

  await delay(800);

  // ── 4. DDoS HTTP Flood (25 rapid → MEDIUM at 8, CRITICAL at 20)
  console.log('\n── DDoS HTTP Flood ──');
  for (let i = 1; i <= 25; i++) {
    const r = await post('/api/events', {
      event_type: 'HTTP_FLOOD',
      source_ip: '203.0.113.77',
      raw_log: `GET / HTTP/1.1 from 203.0.113.77`,
    });
    if ([1, 8, 20, 25].includes(i))
      console.log(`  [DDOS ${i}/25] status=${r.status} alert=${r.body?.alert?.rule_name || 'none'}`);
    await delay(100);
  }

  await delay(800);

  // ── 5. SQL Injection (3 attempts → HIGH then CRITICAL)
  console.log('\n── SQL Injection ──');
  for (let i = 1; i <= 3; i++) {
    const r = await post('/api/events', {
      event_type: 'SQL_INJECTION',
      source_ip: '172.16.0.44',
      username: 'anonymous',
      raw_log: `SQL injection: ' OR 1=1-- in login form`,
    });
    console.log(`  [SQL ${i}/3] status=${r.status} alert=${r.body?.alert?.rule_name || 'none'}`);
    await delay(500);
  }

  await delay(800);

  // ── 6. MITM (2 events → HIGH then CRITICAL)
  console.log('\n── Man-in-the-Middle ──');
  for (let i = 1; i <= 2; i++) {
    const r = await post('/api/events', {
      event_type: 'MITM_DETECTED',
      source_ip: '192.168.1.77',
      username: null,
      raw_log: `ARP spoofing detected: 192.168.1.77 claiming gateway MAC`,
    });
    console.log(`  [MITM ${i}/2] status=${r.status} alert=${r.body?.alert?.rule_name || 'none'}`);
    await delay(600);
  }

  await delay(800);

  // ── 7. Malware — Spyware (HIGH) then Ransomware (CRITICAL)
  console.log('\n── Malware Detection ──');
  for (const [type, host] of [['SPYWARE', '192.168.1.30'], ['RANSOMWARE', '192.168.1.31']]) {
    const r = await post('/api/events', {
      event_type: 'MALWARE_DETECTED',
      source_ip: host,
      username: 'svc_account',
      malware_type: type,
      raw_log: `${type} signature matched on ${host}`,
    });
    console.log(`  [MALWARE ${type}] status=${r.status} alert=${r.body?.alert?.rule_name || 'none'}`);
    await delay(600);
  }

  await delay(800);

  // ── 8. Phishing — not clicked (MEDIUM) + clicked (HIGH)
  console.log('\n── Phishing ──');
  const phishEvents = [
    { username: 'alice', clicked: false, source_ip: '91.108.4.5' },
    { username: 'bob',   clicked: true,  source_ip: '91.108.4.5' },
  ];
  for (const ev of phishEvents) {
    const r = await post('/api/events', {
      event_type: 'PHISHING_ATTEMPT',
      ...ev,
      raw_log: `Phishing email from 91.108.4.5 targeting ${ev.username}`,
    });
    console.log(`  [PHISHING ${ev.username} clicked=${ev.clicked}] status=${r.status} alert=${r.body?.alert?.rule_name || 'none'}`);
    await delay(500);
  }

  await delay(800);

  // ── 9. Credential Stuffing
  console.log('\n── Credential Stuffing ──');
  const r = await post('/api/events', {
    event_type: 'CREDENTIAL_STUFFING',
    source_ip: '45.33.32.156',
    username: 'admin',
    raw_log: `Multiple failed logins with different credentials from 45.33.32.156`,
  });
  console.log(`  [CRED_STUFFING] status=${r.status} alert=${r.body?.alert?.rule_name || 'none'}`);

  console.log('\n✅  Simulation complete. Check your dashboard!');
}

run();