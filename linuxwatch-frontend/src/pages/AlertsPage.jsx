import { useState } from 'react'
import AlertsTable from '../components/AlertsTable'
import PageHeader from '../components/PageHeader'
import GlassSurface from '../components/GlassSurface'
import BlurText from '../components/BlurText'
import { useAlerts, useConnection } from '../context/SocketContext'
import { fmt } from '../utils'
import { memo } from 'react'

const SEV_FILTERS    = ['', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
const STATUS_FILTERS = ['', 'OPEN', 'ACKNOWLEDGED', 'RESOLVED']

function AlertsPage() {
  const { alerts, loading, refreshAlerts, updateAlertStatus } = useAlerts()
  const { userRole } = useConnection()
  const [severity, setSeverity] = useState('')
  const [status,   setStatus]   = useState('')
  const [selected, setSelected] = useState(null)

  const filtered = alerts.filter(a =>
    (!severity || a.severity === severity) &&
    (!status   || a.status   === status)
  )

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Alerts"
        subtitle={`${filtered.length} alert${filtered.length !== 1 ? 's' : ''}${(severity || status) ? ' (filtered)' : ''}`}
        action={
          <button onClick={() => refreshAlerts({ severity, status })} className="btn-secondary" style={{ fontSize: 11, padding: '6px 14px' }}>
            ↻ refresh
          </button>
        }
      />

      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 9, fontFamily: 'var(--font-body)', color: 'var(--text-dim)', marginRight: 2, letterSpacing: '0.1em' }}>SEV</span>
        {SEV_FILTERS.map(s => (
          <FilterBtn key={s} label={s || 'All'} active={severity === s} onClick={() => setSeverity(s)} sev={s} />
        ))}
        <div style={{ width: 1, height: 18, background: 'var(--border)', margin: '0 4px' }} />
        <span style={{ fontSize: 9, fontFamily: 'var(--font-body)', color: 'var(--text-dim)', marginRight: 2, letterSpacing: '0.1em' }}>STATUS</span>
        {STATUS_FILTERS.map(s => (
          <FilterBtn key={s} label={s || 'All'} active={status === s} onClick={() => setStatus(s)} />
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 320px' : '1fr', gap: 12 }}>
        <GlassSurface width="100%" borderRadius={4} backgroundOpacity={0.45} style={{ overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontSize: 12 }}>
              Loading…
            </div>
          ) : (
            <AlertsTable
              alerts={filtered}
              onRefresh={refreshAlerts}
              onStatusUpdate={updateAlertStatus}
              onRowClick={setSelected}
              selectedId={selected?.id}
              userRole={userRole}
            />
          )}
        </GlassSurface>

        {selected && (
          <GlassSurface width="100%" borderRadius={4} backgroundOpacity={0.5} style={{ alignSelf: 'start' }}>
            <div style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <BlurText
                  text={selected.rule_name}
                  as="h3"
                  className="page-title"
                  delay={40}
                />
                <button
                  onClick={() => setSelected(null)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}
                >
                  ×
                </button>
              </div>

              <DetailRow label="Severity" value={selected.severity} highlight={selected.severity === 'CRITICAL' || selected.severity === 'HIGH' ? 'var(--color-accent)' : 'var(--color-accent-secondary)'} />
              <DetailRow label="Status" value={selected.status} />
              <DetailRow label="Source IP" value={selected.source_ip || '—'} mono />
              <DetailRow label="Event" value={selected.event_type || '—'} mono />
              <DetailRow label="User" value={selected.username || '—'} mono />
              <DetailRow label="Time" value={fmt.time(selected.created_at)} mono />

              <div style={{ marginTop: 14, padding: '10px 12px', background: 'var(--color-bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <p style={{ fontSize: 9, fontFamily: 'var(--font-body)', color: 'var(--text-dim)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Description</p>
                <p style={{ fontSize: 11, fontFamily: 'var(--font-body)', color: 'var(--color-text)', lineHeight: 1.5 }}>{selected.description}</p>
              </div>

              {selected.playbook_action && (
                <div style={{ marginTop: 10, padding: '10px 12px', background: 'var(--color-bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                  <p style={{ fontSize: 9, fontFamily: 'var(--font-body)', color: 'var(--text-dim)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Playbook</p>
                  <p style={{ fontSize: 11, fontFamily: 'var(--font-body)', color: 'var(--color-accent-secondary)' }}>{selected.playbook_action}</p>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                {selected.status === 'OPEN' && (
                  <button className="btn-secondary" style={{ flex: 1, fontSize: 10, padding: '6px 0' }}
                    onClick={() => { updateAlertStatus(selected.id, 'ACKNOWLEDGED'); setSelected({ ...selected, status: 'ACKNOWLEDGED' }) }}>
                    Acknowledge
                  </button>
                )}
                {selected.status !== 'RESOLVED' && userRole === 'admin' && (
                  <button className="btn-primary" style={{ flex: 1, fontSize: 10, padding: '6px 0' }}
                    onClick={() => { updateAlertStatus(selected.id, 'RESOLVED'); setSelected({ ...selected, status: 'RESOLVED' }) }}>
                    Resolve
                  </button>
                )}
              </div>
            </div>
          </GlassSurface>
        )}
      </div>
    </div>
  )
}

export default memo(AlertsPage)

function DetailRow({ label, value, mono, highlight }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 10, fontFamily: 'var(--font-body)', color: 'var(--text-dim)' }}>{label}</span>
      <span className={mono ? 'mono-num' : ''} style={{ fontSize: 11, fontFamily: 'var(--font-body)', color: highlight || 'var(--color-text)', fontWeight: 600 }}>{value}</span>
    </div>
  )
}

function FilterBtn({ label, active, onClick, sev }) {
  const sevColor = sev === 'CRITICAL' || sev === 'HIGH' ? 'var(--color-accent)'
    : sev === 'MEDIUM' || sev === 'LOW' ? 'var(--color-accent-secondary)' : null

  return (
    <button onClick={onClick} style={{
      padding: '4px 10px', borderRadius: 'var(--radius-sm)', fontSize: 10,
      fontFamily: 'var(--font-body)', cursor: 'pointer', transition: 'all .15s',
      background: active ? 'var(--accent-dim)' : 'transparent',
      color: active ? (sevColor || 'var(--color-accent)') : 'var(--text-muted)',
      border: `1px solid ${active ? (sevColor || 'var(--color-accent)') : 'var(--border)'}`,
      fontWeight: active ? 600 : 400,
    }}>
      {label}
    </button>
  )
}
