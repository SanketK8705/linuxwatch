import AlertCard from './AlertCard'

export default function LiveFeedSection({ alerts, newAlertIds }) {
  return (
    <div style={{
      background: 'var(--bg-panel)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-xl)', display: 'flex', flexDirection: 'column',
      maxHeight: 440, overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 18px', borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h2 style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.12em',
            color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase',
          }}>
            Live Feed
          </h2>
          <span style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 4, padding: '1px 7px',
            fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)',
          }}>
            {alerts.length}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: 'var(--green)',
            boxShadow: '0 0 8px var(--green)',
            animation: 'pulse-dot 1.5s infinite',
          }} />
          <span style={{ fontSize: 10, color: 'var(--green)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}>
            LIVE
          </span>
        </div>
      </div>

      {/* Feed */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px' }}>
        {alerts.length === 0 ? (
          <div style={{ padding: '40px 0', textAlign: 'center' }}>
            <div style={{ fontSize: 28, marginBottom: 10, opacity: 0.4 }}>⬡</div>
            <p style={{ color: 'var(--text-dim)', fontSize: 11, fontFamily: 'var(--font-mono)', lineHeight: 1.7 }}>
              no alerts yet<br />
              <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>run node simulate.js</span>
            </p>
          </div>
        ) : alerts.map((a, i) => (
          <AlertCard key={a.id || i} alert={a} isNew={newAlertIds?.has(a.id)} />
        ))}
      </div>
    </div>
  )
}