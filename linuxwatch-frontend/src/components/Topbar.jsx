export default function Topbar({ connected, username, onLogout }) {
  return (
    <div style={{
      height: 54, background: 'var(--bg-panel)',
      borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', padding: '0 24px',
      position: 'relative', zIndex: 2,
    }}>
      {/* Left — connection status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '4px 10px', borderRadius: 6,
          background: connected ? 'var(--green-dim)' : 'var(--red-dim)',
          border: `1px solid ${connected ? 'var(--green)' : 'var(--red)'}22`,
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: connected ? 'var(--green)' : 'var(--red)',
            boxShadow: connected ? '0 0 6px var(--green)' : 'none',
            animation: connected ? 'pulse-dot 2s infinite' : 'none',
          }} />
          <span style={{
            color: connected ? 'var(--green)' : 'var(--red)',
            fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 500, letterSpacing: '0.05em',
          }}>
            {connected ? 'LIVE' : 'OFFLINE'}
          </span>
        </div>
        <span style={{ color: 'var(--text-dim)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
          {connected ? 'receiving events' : 'backend unreachable'}
        </span>
      </div>

      {/* Right — user + logout */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 26, height: 26, borderRadius: '50%',
            background: 'var(--accent-dim)', border: '1px solid var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, color: 'var(--accent-2)',
          }}>
            {username?.[0]?.toUpperCase() ?? '?'}
          </div>
          <span style={{ color: 'var(--text-muted)', fontSize: 13, fontFamily: 'var(--font-mono)' }}>
            {username}
          </span>
        </div>
        <button onClick={onLogout} style={{
          background: 'none', border: '1px solid var(--border)',
          borderRadius: 6, color: 'var(--text-muted)',
          fontSize: 11, padding: '4px 12px', cursor: 'pointer',
          fontFamily: 'var(--font-mono)', transition: 'all .15s', letterSpacing: '0.05em',
        }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--red)'; e.currentTarget.style.borderColor = 'var(--red)'; e.currentTarget.style.background = 'var(--red-dim)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'none' }}
        >logout</button>
      </div>
    </div>
  )
}