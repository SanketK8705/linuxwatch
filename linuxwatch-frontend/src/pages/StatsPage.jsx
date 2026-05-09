import { useState, useEffect, useCallback, useRef } from 'react'
import { API_BASE } from '../constants'
import { authHeaders, fmt } from '../utils'

// ── Mini bar chart (pure canvas-free SVG) ──────────────────────────────────
function BarChart({ data, color = 'var(--accent)', height = 80 }) {
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height }}>
      {data.map((d, i) => {
        const pct = (d.value / max) * 100
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
            <div style={{
              width: '100%', height: `${pct}%`, minHeight: d.value ? 3 : 0,
              background: color,
              borderRadius: '3px 3px 0 0',
              boxShadow: d.value ? `0 0 6px ${color}66` : 'none',
              transition: 'height .4s cubic-bezier(.4,0,.2,1)',
              position: 'relative',
            }}>
              {d.value > 0 && (
                <div style={{
                  position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
                  fontSize: 8, fontFamily: 'var(--font-mono)', color, whiteSpace: 'nowrap',
                  marginBottom: 2, opacity: 0.8,
                }}>
                  {d.value}
                </div>
              )}
            </div>
            {d.label && (
              <span style={{ fontSize: 8, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%', textAlign: 'center' }}>
                {d.label}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Donut chart (SVG) ───────────────────────────────────────────────────────
function DonutChart({ segments, size = 120 }) {
  const r = 42, cx = 60, cy = 60
  const circumference = 2 * Math.PI * r
  const total = segments.reduce((s, seg) => s + seg.value, 0)

  let offset = 0
  const arcs = segments.map(seg => {
    const pct = total ? seg.value / total : 0
    const dash = pct * circumference
    const gap  = circumference - dash
    const arc  = { ...seg, dash, gap, offset, pct }
    offset += dash
    return arc
  })

  return (
    <svg width={size} height={size} viewBox="0 0 120 120">
      {/* Track */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth="14" />
      {arcs.map((arc, i) => arc.value > 0 && (
        <circle key={i}
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={arc.color}
          strokeWidth="14"
          strokeDasharray={`${arc.dash} ${arc.gap}`}
          strokeDashoffset={-arc.offset + circumference / 4}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 4px ${arc.color}66)` }}
        />
      ))}
      {/* Center text */}
      <text x={cx} y={cy - 4} textAnchor="middle" fill="var(--text)" fontSize="18" fontWeight="800" fontFamily="'Outfit', sans-serif">
        {total}
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" fill="var(--text-dim)" fontSize="7" fontFamily="'IBM Plex Mono', monospace" letterSpacing="1">
        TOTAL
      </text>
    </svg>
  )
}

// ── Sparkline (SVG) ─────────────────────────────────────────────────────────
function Sparkline({ data, color = 'var(--accent)', width = 120, height = 36 }) {
  if (!data || data.length < 2) return null
  const max = Math.max(...data, 1)
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - (v / max) * height
    return `${x},${y}`
  }).join(' ')

  const fillPts = `0,${height} ${pts} ${width},${height}`

  return (
    <svg width={width} height={height} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id={`sg-${color.replace(/[^a-z]/gi,'')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={fillPts} fill={`url(#sg-${color.replace(/[^a-z]/gi,'')})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5"
        style={{ filter: `drop-shadow(0 0 3px ${color})` }} />
    </svg>
  )
}

// ── Section header ──────────────────────────────────────────────────────────
function SectionLabel({ children }) {
  return (
    <p style={{
      fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-mono)',
      color: 'var(--text-dim)', letterSpacing: '0.12em',
      textTransform: 'uppercase', marginBottom: 12,
    }}>
      {children}
    </p>
  )
}

// ── Card wrapper ────────────────────────────────────────────────────────────
function Card({ children, style }) {
  return (
    <div style={{
      background: 'var(--bg-panel)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-xl)', padding: '18px 20px',
      ...style,
    }}>
      {children}
    </div>
  )
}

// ── Main page ───────────────────────────────────────────────────────────────
export default function StatsPage() {
  const [stats,   setStats]   = useState(null)
  const [history, setHistory] = useState([]) // array of stat snapshots for sparklines
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [lastUpdated, setLastUpdated] = useState(null)
  const intervalRef = useRef(null)

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/stats`, { headers: authHeaders() })
      if (!res.ok) { setError('Failed to load stats'); return }
      const data = await res.json()
      setStats(data)
      setLastUpdated(new Date())
      setHistory(prev => [...prev.slice(-23), data.openAlerts]) // keep last 24 points
      setError('')
    } catch {
      setError('Cannot reach backend')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchStats()
    intervalRef.current = setInterval(fetchStats, 15000) // auto-refresh every 15s
    return () => clearInterval(intervalRef.current)
  }, [fetchStats])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <p style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>Loading…</p>
    </div>
  )

  if (error) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <p style={{ color: 'var(--red)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{error}</p>
    </div>
  )

  const sev = stats?.bySeverity || {}
  const total = stats?.openAlerts || 0
  const events24h = stats?.eventsLast24h || 0
  const recentAlerts = stats?.recentAlerts || []

  const SEV_COLORS = {
    CRITICAL: 'var(--red)',
    HIGH:     'var(--orange)',
    MEDIUM:   'var(--yellow)',
    LOW:      'var(--blue)',
  }

  const donutSegments = ['CRITICAL','HIGH','MEDIUM','LOW'].map(s => ({
    value: sev[s] || 0,
    color: SEV_COLORS[s],
    label: s,
  }))

  // Bar chart: severity breakdown
  const sevBars = ['CRITICAL','HIGH','MEDIUM','LOW'].map(s => ({
    value: sev[s] || 0,
    label: s.slice(0,4),
    color: SEV_COLORS[s],
  }))

  // Bar chart: alert activity from recentAlerts (group by hour)
  const hourBuckets = Array.from({ length: 12 }, (_, i) => {
    const h = new Date()
    h.setHours(h.getHours() - (11 - i), 0, 0, 0)
    const label = h.getHours().toString().padStart(2,'0') + 'h'
    const count = recentAlerts.filter(a => {
      const t = new Date(a.created_at)
      return t.getHours() === h.getHours()
    }).length
    return { label, value: count }
  })

  // Detection rate (resolved / total)
  const resolvedCount = recentAlerts.filter(a => a.status === 'RESOLVED').length
  const detectionRate = recentAlerts.length ? Math.round((resolvedCount / recentAlerts.length) * 100) : 0

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontWeight: 900, fontSize: 24, letterSpacing: '-0.5px', marginBottom: 4 }}>Analytics</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Security posture overview</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {lastUpdated && (
            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
              Updated {fmt.ago(lastUpdated)}
            </span>
          )}
          <button onClick={fetchStats} style={{
            padding: '7px 16px', background: 'var(--bg-card)',
            border: '1px solid var(--border)', borderRadius: 8,
            color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer',
            fontFamily: 'var(--font-mono)', transition: 'all .15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'var(--border-light)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)' }}
          >↻ refresh</button>
        </div>
      </div>

      {/* Top KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        {[
          { label: 'Open Alerts',    value: total,      color: 'var(--red)',    sub: 'unresolved' },
          { label: 'Events / 24h',   value: events24h,  color: 'var(--accent)', sub: 'raw events ingested' },
          { label: 'Critical',       value: sev.CRITICAL||0, color: 'var(--red)',    sub: 'immediate action' },
          { label: 'Response Rate',  value: `${detectionRate}%`, color: 'var(--green)', sub: 'of recent resolved' },
        ].map(card => (
          <Card key={card.label} style={{ position: 'relative', overflow: 'hidden' }}>
            <div style={{
              position: 'absolute', top: 0, right: 0,
              width: 80, height: 80, borderRadius: '50%',
              background: card.color + '0d',
              transform: 'translate(30%,-30%)',
              pointerEvents: 'none',
            }} />
            <p style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
              {card.label}
            </p>
            <p style={{ fontSize: 34, fontWeight: 800, color: card.color, lineHeight: 1, fontFamily: 'var(--font-ui)', marginBottom: 8 }}>
              {card.value}
            </p>
            <p style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
              {card.sub}
            </p>
          </Card>
        ))}
      </div>

      {/* Middle row: donut + severity bars + sparkline */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr 1fr', gap: 12, marginBottom: 12 }}>

        {/* Donut — severity distribution */}
        <Card>
          <SectionLabel>Alert Distribution</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <DonutChart segments={donutSegments} size={130} />
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {['CRITICAL','HIGH','MEDIUM','LOW'].map(s => (
                <div key={s} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: SEV_COLORS[s], boxShadow: `0 0 4px ${SEV_COLORS[s]}` }} />
                    <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{s}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 60, height: 3, borderRadius: 2, background: 'var(--border)', position: 'relative', overflow: 'hidden' }}>
                      <div style={{
                        position: 'absolute', left: 0, top: 0, bottom: 0,
                        width: total ? `${((sev[s]||0)/total)*100}%` : '0%',
                        background: SEV_COLORS[s],
                        borderRadius: 2,
                        boxShadow: `0 0 4px ${SEV_COLORS[s]}`,
                      }} />
                    </div>
                    <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text)', fontWeight: 700, minWidth: 16, textAlign: 'right' }}>
                      {sev[s]||0}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Bar chart — activity by hour */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <SectionLabel>Alert Activity (last 12h)</SectionLabel>
            <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', marginBottom: 12 }}>
              by hour
            </span>
          </div>
          {hourBuckets.every(b => b.value === 0) ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 100 }}>
              <p style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>∅ no recent activity</p>
            </div>
          ) : (
            <BarChart data={hourBuckets} color="var(--accent)" height={100} />
          )}
        </Card>

        {/* Sparkline — open alerts over session */}
        <Card>
          <SectionLabel>Open Alerts Trend</SectionLabel>
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--font-ui)', lineHeight: 1 }}>
              {total}
            </p>
            <p style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', marginTop: 4 }}>
              open right now
            </p>
          </div>
          <div style={{ marginBottom: 12 }}>
            <Sparkline data={history.length > 1 ? history : [0, total]} color="var(--accent)" width={160} height={44} />
          </div>
          <p style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
            Sampled every 15s during session
          </p>

          {/* Mini severity pills */}
          <div style={{ marginTop: 14, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['CRITICAL','HIGH','MEDIUM','LOW'].map(s => (
              sev[s] > 0 && (
                <span key={s} style={{
                  padding: '2px 8px', borderRadius: 4,
                  background: SEV_COLORS[s] + '18',
                  border: `1px solid ${SEV_COLORS[s]}30`,
                  color: SEV_COLORS[s],
                  fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
                }}>
                  {sev[s]} {s.slice(0,3)}
                </span>
              )
            ))}
          </div>
        </Card>
      </div>

      {/* Bottom row: severity bars + recent alert list */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>

        {/* Severity bar chart */}
        <Card>
          <SectionLabel>By Severity</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {['CRITICAL','HIGH','MEDIUM','LOW'].map(s => {
              const pct = total ? ((sev[s]||0) / total) * 100 : 0
              return (
                <div key={s}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: SEV_COLORS[s], fontWeight: 600 }}>{s}</span>
                    <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                      {sev[s]||0} ({pct.toFixed(0)}%)
                    </span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', width: `${pct}%`,
                      background: SEV_COLORS[s],
                      borderRadius: 3,
                      boxShadow: pct > 0 ? `0 0 8px ${SEV_COLORS[s]}66` : 'none',
                      transition: 'width .6s cubic-bezier(.4,0,.2,1)',
                    }} />
                  </div>
                </div>
              )
            })}
          </div>

          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { label: 'Total Open', value: total, color: 'var(--text)' },
                { label: 'Events 24h', value: events24h, color: 'var(--accent-2)' },
              ].map(m => (
                <div key={m.label} style={{ textAlign: 'center', padding: '10px 8px', background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <p style={{ fontSize: 22, fontWeight: 800, color: m.color, fontFamily: 'var(--font-ui)' }}>{m.value}</p>
                  <p style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{m.label}</p>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Recent alerts list */}
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <SectionLabel>Recent Alerts</SectionLabel>
          </div>
          {recentAlerts.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
              ∅ no recent alerts
            </div>
          ) : (
            <div>
              {recentAlerts.map((a, i) => {
                const c = SEV_COLORS[a.severity] || 'var(--accent)'
                const statusColor = a.status === 'OPEN' ? 'var(--red)' : a.status === 'RESOLVED' ? 'var(--green)' : 'var(--yellow)'
                return (
                  <div key={a.id || i} style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '12px 20px',
                    borderBottom: i < recentAlerts.length - 1 ? '1px solid var(--border)' : 'none',
                    transition: 'background .12s',
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    {/* Severity dot */}
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                      background: c, boxShadow: `0 0 6px ${c}`,
                    }} />

                    {/* Rule name */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: 'var(--text)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {a.rule_name}
                      </p>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {a.description}
                      </p>
                    </div>

                    {/* Source IP */}
                    {a.source_ip && (
                      <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', flexShrink: 0 }}>
                        {a.source_ip}
                      </span>
                    )}

                    {/* Status badge */}
                    <span style={{
                      padding: '2px 8px', borderRadius: 4, flexShrink: 0,
                      background: statusColor + '18', color: statusColor,
                      fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
                      border: `1px solid ${statusColor}30`, letterSpacing: '0.06em',
                    }}>
                      {a.status}
                    </span>

                    {/* Time */}
                    <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', flexShrink: 0, minWidth: 48, textAlign: 'right' }}>
                      {fmt.ago(a.created_at)}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}