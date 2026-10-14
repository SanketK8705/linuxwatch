import SeverityBadge from './SeverityBadge'
import { fmt } from '../utils'
import { SEV_META } from '../constants'

export default function AlertCard({ alert, isNew }) {
  const m = SEV_META[alert.severity] || SEV_META.LOW
  return (
    <div className={isNew ? 'animate-slide-in' : ''} style={{
      padding: '11px 14px', borderRadius: 8,
      background: isNew ? m.dim : 'var(--bg-card)',
      border: `1px solid ${isNew ? m.color + '55' : 'var(--border)'}`,
      transition: 'all .3s', marginBottom: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <SeverityBadge severity={alert.severity} />
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{alert.rule_name}</span>
        </div>
        <span style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
          {fmt.ago(alert.created_at)}
        </span>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: alert.source_ip ? 4 : 0, lineHeight: 1.5 }}>
        {alert.description}
      </p>
      {alert.event_type && (
        <p style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginBottom: alert.source_ip ? 3 : 0 }}>
          event: {alert.event_type}
        </p>
      )}
      {alert.source_ip && (
        <p style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
          ⌁ {alert.source_ip}
        </p>
      )}
    </div>
  )
}