import { useState } from 'react'
import SeverityBadge from './SeverityBadge'
import StatusBadge from './StatusBadge'
import { fmt, authHeaders } from '../utils'
import { API_BASE } from '../constants'

export default function AlertsTable({ alerts, onRefresh, onStatusUpdate, compact }) {
  const [updating, setUpdating] = useState(null)

  const updateStatus = async (id, status) => {
    setUpdating(id)
    try {
      await fetch(`${API_BASE}/alerts/${id}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ status }),
      })
      // Update in-place via callback (fixes all-alerts-changing bug)
      if (onStatusUpdate) {
        onStatusUpdate(id, status)
      } else {
        onRefresh?.()
      }
    } catch {}
    setUpdating(null)
  }

  if (!alerts.length) return (
    <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
      ∅ no alerts found
    </div>
  )

  const th = {
    padding: '10px 16px', textAlign: 'left', color: 'var(--text-dim)', fontSize: 10,
    fontFamily: 'var(--font-mono)', fontWeight: 600, borderBottom: '1px solid var(--border)',
    whiteSpace: 'nowrap', letterSpacing: '0.1em', textTransform: 'uppercase',
    background: 'var(--bg-card)',
  }
  const td = { padding: '11px 16px', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={th}>Sev</th>
            <th style={th}>Rule</th>
            {!compact && <th style={th}>Source IP</th>}
            {!compact && <th style={th}>Description</th>}
            <th style={th}>Status</th>
            <th style={th}>Time</th>
            {!compact && <th style={th}>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {alerts.map(a => (
            <tr key={a.id}
              style={{ transition: 'background .12s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <td style={td}><SeverityBadge severity={a.severity} /></td>
              <td style={{ ...td, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text)', fontWeight: 500 }}>
                {a.rule_name}
              </td>
              {!compact && (
                <td style={{ ...td, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                  {a.source_ip || '—'}
                </td>
              )}
              {!compact && (
                <td style={{ ...td, color: 'var(--text-muted)', maxWidth: 240 }}>
                  <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>
                    {a.description}
                  </span>
                </td>
              )}
              <td style={td}><StatusBadge status={a.status} /></td>
              <td style={{ ...td, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
                {fmt.time(a.created_at)}
              </td>
              {!compact && (
                <td style={td}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {a.status === 'OPEN' && (
                      <Btn
                        label="ack"
                        color="var(--yellow)"
                        dim="var(--yellow-dim)"
                        disabled={updating === a.id}
                        onClick={() => updateStatus(a.id, 'ACKNOWLEDGED')}
                      />
                    )}
                    {a.status !== 'RESOLVED' && (
                      <Btn
                        label="resolve"
                        color="var(--green)"
                        dim="var(--green-dim)"
                        disabled={updating === a.id}
                        onClick={() => updateStatus(a.id, 'RESOLVED')}
                      />
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Btn({ label, color, dim, disabled, onClick }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      style={{
        padding: '3px 10px', borderRadius: 4,
        background: dim, border: `1px solid ${color}`,
        color, fontSize: 10, fontFamily: 'var(--font-mono)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1, transition: 'all .12s',
        fontWeight: 600, letterSpacing: '0.05em',
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = color + '33' }}
      onMouseLeave={e => { if (!disabled) e.currentTarget.style.background = dim }}
    >
      {label}
    </button>
  )
}