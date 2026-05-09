import { useState } from 'react'
import { RULES_META, SEV_META } from '../constants'
import SeverityBadge from '../components/SeverityBadge'

export default function RulesPage() {
  const [filter, setFilter] = useState('')
  const [search, setSearch] = useState('')

  const filtered = RULES_META.filter(r =>
    (!filter || r.severity === filter) &&
    (!search || r.name.toLowerCase().includes(search.toLowerCase()) || r.type.toLowerCase().includes(search.toLowerCase()))
  )

  const counts = RULES_META.reduce((acc, r) => {
    acc[r.severity] = (acc[r.severity] || 0) + 1
    return acc
  }, {})

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 22 }}>
        <div>
          <h1 style={{ fontWeight: 900, fontSize: 24, letterSpacing: '-0.5px', marginBottom: 4 }}>
            Detection Rules
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            {RULES_META.length} active rules across {Object.keys(counts).length} severity levels
          </p>
        </div>
      </div>

      {/* Severity summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 22 }}>
        {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(sev => {
          const m = SEV_META[sev]
          return (
            <div key={sev} style={{
              background: 'var(--bg-panel)', border: `1px solid ${m.color}30`,
              borderRadius: 'var(--radius-lg)', padding: '14px 16px',
              cursor: 'pointer', transition: 'all .15s',
              boxShadow: filter === sev ? `0 0 12px ${m.color}22` : 'none',
              borderColor: filter === sev ? m.color : m.color + '30',
            }}
              onClick={() => setFilter(filter === sev ? '' : sev)}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: m.color, boxShadow: `0 0 6px ${m.color}`, display: 'block' }} />
                <span style={{ fontSize: 20, fontWeight: 800, color: m.color }}>{counts[sev] || 0}</span>
              </div>
              <p style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                {sev}
              </p>
            </div>
          )
        })}
      </div>

      {/* Search + filter */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
          <span style={{
            position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--text-dim)', fontSize: 12, pointerEvents: 'none',
          }}>⌕</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search rules or event types…"
            style={{
              width: '100%', padding: '8px 12px 8px 28px',
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 8, color: 'var(--text)',
              fontFamily: 'var(--font-mono)', fontSize: 12, outline: 'none',
              transition: 'border-color .15s',
            }}
            onFocus={e => e.target.style.borderColor = 'var(--accent)'}
            onBlur={e  => e.target.style.borderColor = 'var(--border)'}
          />
        </div>
        {filter && (
          <button onClick={() => setFilter('')} style={{
            padding: '6px 12px', borderRadius: 6, background: 'var(--accent-dim)',
            border: '1px solid var(--accent)', color: 'var(--accent-2)',
            fontSize: 11, fontFamily: 'var(--font-mono)', cursor: 'pointer',
          }}>
            ✕ {filter}
          </button>
        )}
        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', marginLeft: 'auto' }}>
          {filtered.length} rule{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Rules grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
        {filtered.map(rule => {
          const m = SEV_META[rule.severity]
          return (
            <div key={rule.name} style={{
              background: 'var(--bg-panel)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)', padding: '16px 18px',
              transition: 'all .15s', position: 'relative', overflow: 'hidden',
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = m.color + '44'; e.currentTarget.style.background = 'var(--bg-card)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-panel)' }}
            >
              {/* Left accent bar */}
              <div style={{
                position: 'absolute', left: 0, top: 0, bottom: 0,
                width: 3, background: m.color, borderRadius: '12px 0 0 12px',
                boxShadow: `2px 0 8px ${m.color}44`,
              }} />

              <div style={{ paddingLeft: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--text)', letterSpacing: '0.02em' }}>
                    {rule.name}
                  </span>
                  <SeverityBadge severity={rule.severity} />
                </div>

                <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 10 }}>
                  {rule.desc}
                </p>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Tag label="event" value={rule.type} color="var(--blue)" />
                  <Tag label="trigger" value={rule.trigger} color="var(--accent-2)" />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
          ∅ no rules match
        </div>
      )}
    </div>
  )
}

function Tag({ label, value, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, borderRadius: 4, overflow: 'hidden', border: `1px solid ${color}25` }}>
      <span style={{
        padding: '2px 7px', fontSize: 9, fontFamily: 'var(--font-mono)',
        background: color + '20', color: color, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
      }}>
        {label}
      </span>
      <span style={{
        padding: '2px 8px', fontSize: 10, fontFamily: 'var(--font-mono)',
        background: 'var(--bg-card)', color: 'var(--text-muted)',
      }}>
        {value}
      </span>
    </div>
  )
}