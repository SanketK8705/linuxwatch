import GlassSurface from './GlassSurface'
import { memo } from 'react'

const Topbar = memo(function Topbar({ connected, username, userRole, onLogout, critCount = 0, lowMedCount = 0 }) {
  return (
    <GlassSurface
      variant="chrome"
      width="100%"
      height={52}
      borderRadius={0}
      backgroundOpacity={0.4}
      style={{ borderBottom: '1px solid var(--border)', flexShrink: 0 }}
    >
      <div style={{
        height: 52, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', padding: '0 20px', width: '100%',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '3px 10px', borderRadius: 'var(--radius-sm)',
            background: connected ? 'var(--green-dim)' : 'var(--red-dim)',
            border: `1px solid ${connected ? 'var(--green)' : 'var(--color-accent)'}33`,
          }}>
            <div style={{
              width: 5, height: 5, borderRadius: '50%',
              background: connected ? 'var(--green)' : 'var(--color-accent)',
              animation: connected ? 'pulse-dot 2s infinite' : 'none',
            }} />
            <span style={{
              color: connected ? 'var(--green)' : 'var(--color-accent)',
              fontSize: 10, fontFamily: 'var(--font-body)', fontWeight: 500, letterSpacing: '0.08em',
            }}>
              {connected ? 'LIVE' : 'OFFLINE'}
            </span>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <CountPill label="CRIT" value={critCount} color="var(--color-accent)" />
            <CountPill label="LOW/MED" value={lowMedCount} color="var(--color-accent-secondary)" />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 24, height: 24, borderRadius: 'var(--radius-sm)',
              background: 'var(--accent-dim)', border: '1px solid var(--color-accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 700, color: 'var(--color-accent)', fontFamily: 'var(--font-body)',
            }}>
              {username?.[0]?.toUpperCase() ?? '?'}
            </div>
            <span style={{ color: 'var(--text-muted)', fontSize: 12, fontFamily: 'var(--font-body)' }}>
              {username}
            </span>
            <span style={{ color: 'var(--color-accent-secondary)', fontSize: 9, fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>
              {userRole}
            </span>
          </div>
          <button onClick={onLogout} className="btn-secondary" style={{
            fontSize: 10, padding: '4px 10px', letterSpacing: '0.05em',
          }}>
            logout
          </button>
        </div>
      </div>
    </GlassSurface>
  )
})

export default Topbar

function CountPill({ label, value, color }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '3px 8px', borderRadius: 'var(--radius-sm)',
      border: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)',
    }}>
      <span style={{ fontSize: 9, fontFamily: 'var(--font-body)', color: 'var(--text-dim)', letterSpacing: '0.08em' }}>{label}</span>
      <span className="mono-num" style={{ fontSize: 12, fontWeight: 700, color, fontFamily: 'var(--font-body)' }}>{value}</span>
    </div>
  )
}
