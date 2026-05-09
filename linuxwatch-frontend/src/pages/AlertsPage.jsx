import { useState } from 'react'
import AlertsTable from '../components/AlertsTable'

const SEV_FILTERS    = ['', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
const STATUS_FILTERS = ['', 'OPEN', 'ACKNOWLEDGED', 'RESOLVED']

export default function AlertsPage({ alerts, loading, onRefresh, onStatusUpdate }) {
  const [severity, setSeverity] = useState('')
  const [status,   setStatus]   = useState('')

  const filtered = alerts.filter(a =>
    (!severity || a.severity === severity) &&
    (!status   || a.status   === status)
  )

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 22 }}>
        <div>
          <h1 style={{ fontWeight: 900, fontSize: 24, letterSpacing: '-0.5px', marginBottom: 4 }}>Alerts</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            {filtered.length} alert{filtered.length !== 1 ? 's' : ''}
            {(severity || status) ? ' (filtered)' : ''}
          </p>
        </div>
        <button onClick={() => onRefresh({ severity, status })} style={{
          padding: '7px 16px', background: 'var(--bg-card)',
          border: '1px solid var(--border)', borderRadius: 8,
          color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer',
          fontFamily: 'var(--font-mono)', transition: 'all .15s', letterSpacing: '0.05em',
        }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'var(--border-light)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)' }}
        >↻ refresh</button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', marginRight: 4, letterSpacing: '0.1em' }}>SEV</span>
        {SEV_FILTERS.map(s => (
          <FilterBtn key={s} label={s || 'All'} active={severity === s} onClick={() => setSeverity(s)} />
        ))}
        <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 6px' }} />
        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', marginRight: 4, letterSpacing: '0.1em' }}>STATUS</span>
        {STATUS_FILTERS.map(s => (
          <FilterBtn key={s} label={s || 'All'} active={status === s} onClick={() => setStatus(s)} />
        ))}
      </div>

      {/* Table */}
      <div style={{
        background: 'var(--bg-panel)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-xl)', overflow: 'hidden',
      }}>
        {loading
          ? <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
              Loading…
            </div>
          : <AlertsTable alerts={filtered} onRefresh={onRefresh} onStatusUpdate={onStatusUpdate} />
        }
      </div>
    </div>
  )
}

function FilterBtn({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: '5px 12px', borderRadius: 6, fontSize: 11,
      fontFamily: 'var(--font-mono)', cursor: 'pointer', transition: 'all .15s',
      background: active ? 'var(--accent-dim)' : 'transparent',
      color: active ? 'var(--accent-2)' : 'var(--text-muted)',
      border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
      fontWeight: active ? 600 : 400,
    }}
      onMouseEnter={e => { if (!active) { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'var(--border-light)' }}}
      onMouseLeave={e => { if (!active) { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)' }}}
    >
      {label}
    </button>
  )
}