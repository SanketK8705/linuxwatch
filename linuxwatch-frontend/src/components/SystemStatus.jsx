export default function SystemStatus({ connected, alertCount }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 16,
      padding: '8px 14px', background: 'var(--bg-card)',
      border: '1px solid var(--border)', borderRadius: 6,
      fontSize: 12, fontFamily: 'var(--font-mono)',
    }}>
      <span style={{ color: connected ? 'var(--green)' : 'var(--red)' }}>
        {connected ? '● CONNECTED' : '● OFFLINE'}
      </span>
      <span style={{ color: 'var(--text-dim)' }}>|</span>
      <span style={{ color: 'var(--text-muted)' }}>{alertCount} alerts total</span>
    </div>
  )
}