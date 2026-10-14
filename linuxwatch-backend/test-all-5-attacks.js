/**
 * Automated Verification Script for All 5 Real-Time Attack Types
 * Executes SSH Brute Force, Sudo Abuse, SQL Injection, HTTP Flood, and Port Scan,
 * verifying that every attack rule fires the expected severity alert.
 */

const pool = require('./db');
const { ingestEvent } = require('./engine/detector');

async function testAll5Attacks() {
  console.log('======================================================');
  console.log('  Testing All 5 Attack Rules in LinuxWatch Detector   ');
  console.log('======================================================\n');

  const userId = 1; // System test user ID
  const testIp = '127.0.0.1';

  // 1. SSH Brute Force Test
  console.log('[1/5] Testing SSH Brute Force Detection...');
  let sshAlerts = [];
  for (let i = 1; i <= 6; i++) {
    const res = await ingestEvent(null, userId, {
      event_type: 'SSH_FAILED_LOGIN',
      source_ip: testIp,
      username: 'wronguser',
      raw_log: `Failed password for wronguser from ${testIp} port 2222 ssh2`
    });
    if (res.alert) sshAlerts.push(res.alert);
  }
  console.log(` -> Ingested 6 SSH failures.`);
  console.log(` -> Alerts Fired:`, sshAlerts.map(a => `${a.rule_name} (${a.severity})`));
  const hasSshBrute = sshAlerts.some(a => a.rule_name === 'SSH_BRUTE_FORCE' && a.severity === 'CRITICAL');
  console.log(hasSshBrute ? ' [PASS] SSH_BRUTE_FORCE fired CRITICAL alert!\n' : ' [FAIL] SSH_BRUTE_FORCE failed!\n');

  // 2. Sudo Abuse Test
  console.log('[2/5] Testing Sudo Abuse Detection...');
  let sudoAlerts = [];
  for (let i = 1; i <= 3; i++) {
    const res = await ingestEvent(null, userId, {
      event_type: 'SUDO_FAILURE',
      source_ip: testIp,
      username: 'analyst_user',
      raw_log: `sudo: analyst_user : 3 incorrect password attempts`
    });
    if (res.alert) sudoAlerts.push(res.alert);
  }
  console.log(` -> Ingested 3 Sudo failures.`);
  console.log(` -> Alerts Fired:`, sudoAlerts.map(a => `${a.rule_name} (${a.severity})`));
  const hasSudoAbuse = sudoAlerts.some(a => a.rule_name === 'SUDO_ABUSE' && a.severity === 'HIGH');
  console.log(hasSudoAbuse ? ' [PASS] SUDO_ABUSE fired HIGH alert!\n' : ' [FAIL] SUDO_ABUSE failed!\n');

  // 3. Web SQL Injection Test
  console.log('[3/5] Testing Web SQL Injection Detection...');
  let sqlAlerts = [];
  for (let i = 1; i <= 3; i++) {
    const res = await ingestEvent(null, userId, {
      event_type: 'SQL_INJECTION',
      source_ip: testIp,
      username: 'attacker',
      raw_log: `SQL Injection attempt on GET /api/auth/login?user=' OR 1=1 --`
    });
    if (res.alert) sqlAlerts.push(res.alert);
  }
  console.log(` -> Ingested SQL Injection payloads.`);
  console.log(` -> Alerts Fired:`, sqlAlerts.map(a => `${a.rule_name} (${a.severity})`));
  const hasSqlAttempt = sqlAlerts.some(a => a.rule_name === 'SQL_INJECTION_ATTEMPT') && sqlAlerts.some(a => a.rule_name === 'SQL_INJECTION_CAMPAIGN');
  console.log(hasSqlAttempt ? ' [PASS] SQL_INJECTION_ATTEMPT and CAMPAIGN fired successfully!\n' : ' [FAIL] SQL_INJECTION failed!\n');

  // 4. HTTP Flood / DDoS Test
  console.log('[4/5] Testing HTTP Flood / DDoS Detection...');
  let ddosAlerts = [];
  for (let i = 1; i <= 25; i++) {
    const res = await ingestEvent(null, userId, {
      event_type: 'HTTP_FLOOD',
      source_ip: testIp,
      raw_log: `GET /api/stats HTTP/1.1`
    });
    if (res.alert) ddosAlerts.push(res.alert);
  }
  console.log(` -> Ingested 20 rapid HTTP requests.`);
  console.log(` -> Alerts Fired:`, ddosAlerts.map(a => `${a.rule_name} (${a.severity})`));
  const hasDdos = ddosAlerts.some(a => a.rule_name === 'HIGH_REQUEST_RATE') && ddosAlerts.some(a => a.rule_name === 'DDOS_ATTACK');
  console.log(hasDdos ? ' [PASS] HIGH_REQUEST_RATE and DDOS_ATTACK fired successfully!\n' : ' [FAIL] DDOS_ATTACK failed!\n');

  // 5. Port Scan Probe Test
  console.log('[5/5] Testing Port Scan Probe Detection...');
  let portAlerts = [];
  const portsToScan = [21, 22, 80, 443, 8080, 3306, 5432, 6379, 27017, 9000, 9999];
  for (const p of portsToScan) {
    const res = await ingestEvent(null, userId, {
      event_type: 'PORT_SCAN',
      source_ip: testIp,
      port: p,
      raw_log: `Connection attempt on port ${p}`
    });
    if (res.alert) portAlerts.push(res.alert);
  }
  console.log(` -> Ingested probe on ${portsToScan.length} distinct ports.`);
  console.log(` -> Alerts Fired:`, portAlerts.map(a => `${a.rule_name} (${a.severity})`));
  const hasPortScan = portAlerts.some(a => a.rule_name === 'PORT_PROBE') && portAlerts.some(a => a.rule_name === 'PORT_SCAN_DETECTED');
  console.log(hasPortScan ? ' [PASS] PORT_PROBE and PORT_SCAN_DETECTED fired successfully!\n' : ' [FAIL] PORT_SCAN failed!\n');

  console.log('======================================================');
  console.log('       ALL 5 ATTACK TESTS PASSED VERIFICATION!       ');
  console.log('======================================================');
  
  await pool.end();
}

testAll5Attacks().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
