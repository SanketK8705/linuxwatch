export const BACKEND = 'http://localhost:3001'
export const API_BASE    = `${BACKEND}/api`
export const SOCKET_URL  = BACKEND

export const SEV_META = {
  CRITICAL: { color: 'var(--red)',    dim: 'var(--red-dim)',    label: 'CRITICAL' },
  HIGH:     { color: 'var(--orange)', dim: 'var(--orange-dim)', label: 'HIGH'     },
  MEDIUM:   { color: 'var(--yellow)', dim: 'var(--yellow-dim)', label: 'MEDIUM'   },
  LOW:      { color: 'var(--blue)',   dim: 'var(--blue-dim)',   label: 'LOW'      },
}

export const STATUS_META = {
  OPEN:         { color: 'var(--red)',    label: 'OPEN'     },
  ACKNOWLEDGED: { color: 'var(--yellow)', label: 'ACK'      },
  RESOLVED:     { color: 'var(--green)',  label: 'RESOLVED' },
}

export const RULES_META = [
  { name: 'SSH_LOGIN_ATTEMPT',      type: 'SSH_FAILED_LOGIN',    trigger: '2 failures',    severity: 'LOW',      desc: 'Multiple SSH login failures detected from a single source.' },
  { name: 'SSH_BRUTE_FORCE',        type: 'SSH_FAILED_LOGIN',    trigger: '5 in 60s',      severity: 'CRITICAL', desc: 'Rapid SSH brute-force attack pattern detected.' },
  { name: 'PORT_PROBE',             type: 'PORT_SCAN',           trigger: '4 in 10s',      severity: 'MEDIUM',   desc: 'Port probing activity detected from source.' },
  { name: 'PORT_SCAN_DETECTED',     type: 'PORT_SCAN',           trigger: '10 in 10s',     severity: 'HIGH',     desc: 'Aggressive port scan sweep in progress.' },
  { name: 'SUDO_ABUSE',             type: 'SUDO_FAILURE',        trigger: '3 in 30s',      severity: 'HIGH',     desc: 'Repeated sudo privilege escalation failures.' },
  { name: 'HIGH_REQUEST_RATE',      type: 'HTTP_FLOOD',          trigger: '8 in 5s',       severity: 'MEDIUM',   desc: 'Elevated HTTP request rate from single IP.' },
  { name: 'DDOS_ATTACK',            type: 'HTTP_FLOOD',          trigger: '20 in 5s',      severity: 'CRITICAL', desc: 'Distributed denial-of-service attack underway.' },
  { name: 'SQL_INJECTION_ATTEMPT',  type: 'SQL_INJECTION',       trigger: '1st hit',       severity: 'HIGH',     desc: 'SQL injection payload detected in request.' },
  { name: 'SQL_INJECTION_CAMPAIGN', type: 'SQL_INJECTION',       trigger: '3 in 60s',      severity: 'CRITICAL', desc: 'Sustained SQL injection campaign detected.' },
  { name: 'MITM_ATTACK',            type: 'MITM_DETECTED',       trigger: '1st hit',       severity: 'HIGH',     desc: 'Man-in-the-middle attack vector identified.' },
  { name: 'MITM_PERSISTENT',        type: 'MITM_DETECTED',       trigger: '2nd in 120s',   severity: 'CRITICAL', desc: 'Persistent MITM attack — ongoing interception.' },
  { name: 'MALWARE_DETECTED',       type: 'MALWARE_DETECTED',    trigger: 'any',           severity: 'HIGH',     desc: 'Malware signature matched (spyware/trojan).' },
  { name: 'MALWARE_CRITICAL',       type: 'MALWARE_DETECTED',    trigger: 'ransomware/rootkit', severity: 'CRITICAL', desc: 'Critical malware — ransomware or rootkit detected.' },
  { name: 'PHISHING_ATTEMPT',       type: 'PHISHING_ATTEMPT',    trigger: 'link not clicked', severity: 'MEDIUM', desc: 'Phishing link delivered but not yet clicked.' },
  { name: 'PHISHING_CLICKED',       type: 'PHISHING_ATTEMPT',    trigger: 'clicked=true',  severity: 'HIGH',     desc: 'User clicked phishing link — credentials at risk.' },
  { name: 'CREDENTIAL_STUFFING',    type: 'CREDENTIAL_STUFFING', trigger: 'any',           severity: 'HIGH',     desc: 'Credential stuffing attack using leaked credentials.' },
]