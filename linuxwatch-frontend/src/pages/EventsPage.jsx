import { useState, useEffect, useCallback } from 'react'
import { API_BASE } from '../constants'
import { authHeaders, fmt } from '../utils'

const EVENT_TYPES = [
  '', 'SSH_FAILED_LOGIN', 'PORT_SCAN', 'SUDO_FAILURE',
  'HTTP_FLOOD', 'SQL_INJECTION', 'MITM_DETECTED',
  'MALWARE_DETECTED', 'PHISHING_ATTEMPT', 'CREDENTIAL_STUFFING',
]

const TYPE_COLORS = {
  SSH_FAILED_LOGIN:    'var(--orange)',
  PORT_SCAN:           'var(--yellow)',
  SUDO_FAILURE:        'var(--red)',
  HTTP_FLOOD:          'var(--orange)',
  SQL_INJECTION:       'var(--red)',
  MITM_DETECTED:       'var(--red)',
  MALWARE_DETECTED:    'var(--red)',
  PHISHING_ATTEMPT:    'var(--yellow)',
  CREDENTIAL_STUFFING: 'var(--orange)',
}

export default function EventsPage() {
  const [events,  setEvents]  = useState([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('')
  const [error, setError] = useState('')

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = typeFilter ? `?event_type=${typeFilter}` : ''
      const res = await fetch(`${API_BASE}/events${params}`, { headers: authHeaders() })
      if (res.ok) {
        setEvents(await res.json())
      } else {
        setError('Failed to load events')
      }
    } catch {
      setError('Cannot reach backend')
    }
    setLoading(false)
  }, [typeFilter])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  // Count by type for the summary bar
  const typeCounts = events.reduce((acc, e) => {
    acc[e.event_type] = (acc[e.event_type] || 0) + 1
    return acc
  }, {})

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 22 }}>
        <div>
          <h1 style={{ fontWeight: 900, fontSize: 24, letterSpacing: '-0.5px', marginBottom: 4 }}>Events</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            Raw event stream from monitored systems
          </p>
        </div>
        <button onClick={fetchEvents} style={{
          padding: '7px 16px', background: 'var(--bg-card)',
          border: '1px solid var(--border)', borderRadius: 8,
          color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer',
          fontFamily: 'var(--font-mono)', transition: 'all .15s',
        }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'var(--border-light)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)' }}
        >↻ refresh</button>
      </div>

      {/* Type summary chips */}
      {!loading && events.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
          {Object.entries(typeCounts).map(([type, count]) => (
            <div key={type} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '4px 10px', borderRadius: 6,
              background: (TYPE_COLORS[type] || 'var(--accent)') + '15',
              border: `1px solid ${(TYPE_COLORS[type] || 'var(--accent)')}30`,
            }}>
              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: TYPE_COLORS[type] || 'var(--accent)', fontWeight: 600 }}>
                {type}
              </span>
              <span style={{
                fontSize: 10, fontFamily: 'var(--font-mono)',
                background: TYPE_COLORS[type] || 'var(--accent)',
                color: '#000', borderRadius: 3, padding: '0 5px', fontWeight: 700,
              }}>
                {count}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', marginRight: 4, letterSpacing: '0.1em' }}>TYPE</span>
        {EVENT_TYPES.map(t => (
          <button key={t} onClick={() => setTypeFilter(t)} style={{
            padding: '5px 12px', borderRadius: 6, fontSize: 11,
            fontFamily: 'var(--font-mono)', cursor: 'pointer', transition: 'all .15s',
            background: typeFilter === t ? 'var(--accent-dim)' : 'transparent',
            color: typeFilter === t ? 'var(--accent-2)' : 'var(--text-muted)',
            border: `1px solid ${typeFilter === t ? 'var(--accent)' : 'var(--border)'}`,
            fontWeight: typeFilter === t ? 600 : 400,
          }}>
            {t || 'All'}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{
        background: 'var(--bg-panel)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-xl)', overflow: 'hidden',
      }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
            Loading…
          </div>
        ) : error ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <p style={{ color: 'var(--red)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{error}</p>
            <p style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontSize: 11, marginTop: 8 }}>
              Make sure GET /api/events is implemented in your backend
            </p>
          </div>
        ) : events.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
            ∅ no events recorded yet
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Type', 'Source IP', 'Metadata', 'Time'].map(h => (
                    <th key={h} style={{
                      padding: '10px 16px', textAlign: 'left', color: 'var(--text-dim)', fontSize: 10,
                      fontFamily: 'var(--font-mono)', fontWeight: 600, borderBottom: '1px solid var(--border)',
                      whiteSpace: 'nowrap', letterSpacing: '0.1em', textTransform: 'uppercase',
                      background: 'var(--bg-card)',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {events.map((e, i) => {
                  const c = TYPE_COLORS[e.event_type] || 'var(--accent)'
                  return (
                    <tr key={e.id || i}
                      style={{ transition: 'background .12s' }}
                      onMouseEnter={ev => ev.currentTarget.style.background = 'var(--bg-card-hover)'}
                      onMouseLeave={ev => ev.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          padding: '2px 8px', borderRadius: 4,
                          background: c + '15', color: c,
                          fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700,
                          border: `1px solid ${c}30`, letterSpacing: '0.05em',
                        }}>
                          {e.event_type}
                        </span>
                      </td>
                      <td style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                        {e.source_ip || '—'}
                      </td>
                      <td style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', maxWidth: 280 }}>
                        <span style={{
                          display: 'block', overflow: 'hidden', textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap', fontSize: 11, fontFamily: 'var(--font-mono)',
                          color: 'var(--text-dim)',
                        }}>
                          {e.metadata ? JSON.stringify(e.metadata) : '—'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
                        {fmt.date(e.created_at)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}