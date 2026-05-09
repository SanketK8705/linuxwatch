const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: <DashIcon /> },
  { id: 'alerts',    label: 'Alerts',    icon: <AlertIcon /> },
  { id: 'events',    label: 'Events',    icon: <EventIcon /> },
  { id: 'stats',     label: 'Analytics', icon: <StatsIcon /> },
  { id: 'rules',     label: 'Rules',     icon: <RulesIcon /> },
]

function DashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
    </svg>
  )
}
function AlertIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  )
}
function EventIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  )
}
function StatsIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="18" y1="20" x2="18" y2="10"/>
      <line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6"  y1="20" x2="6"  y2="14"/>
    </svg>
  )
}
function RulesIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  )
}

export default function Sidebar({ activePage, onNavigate }) {
  return (
    <div style={{
      width: 220, background: 'var(--bg-panel)',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      position: 'relative', zIndex: 2,
    }}>
      {/* Brand */}
      <div style={{ padding: '22px 20px 18px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: 'var(--accent-dim)',
            border: '1px solid var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 12px var(--accent-glow)',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-2)" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: '-0.3px', fontFamily: 'var(--font-ui)' }}>
            Linux<span className="grad-text">Watch</span>
          </span>
        </div>
        <p style={{ color: 'var(--text-dim)', fontSize: 10, fontFamily: 'var(--font-mono)', paddingLeft: 40, letterSpacing: '0.1em' }}>
          IDS · v1.0
        </p>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '14px 10px' }}>
        <p style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', letterSpacing: '0.15em', textTransform: 'uppercase', padding: '0 10px', marginBottom: 8 }}>
          Navigation
        </p>
        {NAV.map(item => {
          const active = activePage === item.id
          return (
            <button key={item.id} onClick={() => onNavigate(item.id)} style={{
              width: '100%', textAlign: 'left',
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 12px', borderRadius: 8, marginBottom: 2,
              background: active ? 'var(--accent-dim)' : 'transparent',
              border: `1px solid ${active ? 'var(--accent)' : 'transparent'}`,
              color: active ? 'var(--accent-2)' : 'var(--text-muted)',
              cursor: 'pointer', fontSize: 13.5, fontFamily: 'var(--font-ui)',
              fontWeight: active ? 600 : 400, transition: 'all .15s',
              boxShadow: active ? '0 0 12px var(--accent-glow)' : 'none',
            }}
              onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'var(--bg-card)'; e.currentTarget.style.color = 'var(--text)' }}}
              onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}}
            >
              <span style={{ opacity: active ? 1 : 0.6 }}>{item.icon}</span>
              {item.label}
              {active && (
                <span style={{ marginLeft: 'auto', width: 4, height: 4, borderRadius: '50%', background: 'var(--accent-2)', boxShadow: '0 0 6px var(--accent-2)' }} />
              )}
            </button>
          )
        })}
      </nav>

      <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)' }}>
        <p style={{ color: 'var(--text-dim)', fontSize: 10, fontFamily: 'var(--font-mono)' }}>© 2025 LinuxWatch</p>
      </div>
    </div>
  )
}