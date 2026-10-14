import AlertCard from './AlertCard'
import GlassSurface from './GlassSurface'
import { memo } from 'react'

function LiveFeedSection({ alerts, newAlertIds }) {
  return (
    <GlassSurface
      width="100%"
      height="auto"
      borderRadius={4}
      blur={8}
      backgroundOpacity={0.45}
      style={{ maxHeight: 440, display: 'flex', flexDirection: 'column' }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h2 style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
            color: 'var(--text-muted)', fontFamily: 'var(--font-body)', textTransform: 'uppercase',
          }}>
            Live Feed
          </h2>
          <span className="mono-num" style={{
            background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', padding: '1px 6px',
            fontSize: 10, fontFamily: 'var(--font-body)', color: 'var(--text-dim)',
          }}>
            {alerts.length}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{
            width: 5, height: 5, borderRadius: '50%',
            background: 'var(--green)', boxShadow: '0 0 6px var(--green)',
            animation: 'pulse-dot 1.5s infinite',
          }} />
          <span style={{ fontSize: 9, color: 'var(--green)', fontFamily: 'var(--font-body)', letterSpacing: '0.1em' }}>
            LIVE
          </span>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'hidden', padding: '8px 10px' }}>
        {alerts.length === 0 ? (
          <div style={{ padding: '36px 0', textAlign: 'center' }}>
            <p style={{ color: 'var(--color-accent-secondary)', fontSize: 20, marginBottom: 8 }}>◌</p>
            <p style={{ color: 'var(--text-muted)', fontSize: 11, fontFamily: 'var(--font-body)', lineHeight: 1.6 }}>
              No active threats detected
            </p>
          </div>
        ) : (
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {alerts.map(alert => (
              <div key={alert.id} style={{ marginBottom: 6 }}>
                <AlertCard alert={alert} isNew={newAlertIds?.has(alert.id)} />
              </div>
            ))}
          </div>
        )}
      </div>
    </GlassSurface>
  )
}

export default memo(LiveFeedSection)
