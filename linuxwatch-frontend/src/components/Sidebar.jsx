import GlassSurface from './GlassSurface'
import { memo } from 'react'

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: <DashIcon /> },
  { id: 'alerts',    label: 'Alerts',    icon: <AlertIcon /> },
  { id: 'events',    label: 'Events',    icon: <EventIcon /> },
  { id: 'stats',     label: 'Analytics', icon: <StatsIcon /> },
  { id: 'rules',     label: 'Rules',     icon: <RulesIcon /> },
  { id: 'ai',        label: 'AI Analyst', icon: <AIIcon /> },
  { id: 'hosts',     label: 'Hosts',     icon: <HostIcon /> },
  { id: 'settings',  label: 'Settings',  icon: <SettingsIcon /> },
  { id: 'users',     label: 'Users',     icon: <UsersIcon />, adminOnly: true },
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
function AIIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M12 2a4 4 0 014 4c0 1.95-1.4 3.58-3.25 3.93L12 22"/><path d="M8 6a4 4 0 018 0"/>
    </svg>
  )
}
function HostIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
    </svg>
  )
}
function SettingsIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
    </svg>
  )
}

function UsersIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
      <path d="M22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
    </svg>
  )
}

export default memo(function Sidebar({ activePage, onNavigate, userRole }) {
  return (
    <GlassSurface
      variant="chrome"
      width={220}
      height="100%"
      borderRadius={0}
      backgroundOpacity={0.4}
      className="sidebar-glass"
      style={{ flexShrink: 0, borderRight: '1px solid var(--border)' }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: 220 }}>
        <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 'var(--radius-sm)',
              background: 'var(--accent-dim)', border: '1px solid var(--color-accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2.5" strokeLinecap="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: '-0.3px', fontFamily: 'var(--font-heading)', color: 'var(--color-text-heading)' }}>
              Linux<span className="grad-text">Watch</span>
            </span>
          </div>
          <p style={{ color: 'var(--text-dim)', fontSize: 9, fontFamily: 'var(--font-body)', paddingLeft: 38, letterSpacing: '0.1em', marginTop: 4 }}>
            IDS · v1.0
          </p>
        </div>

        <nav style={{ flex: 1, padding: '12px 8px', overflowY: 'auto' }}>
          <p style={{ fontSize: 9, fontFamily: 'var(--font-body)', color: 'var(--text-dim)', letterSpacing: '0.15em', textTransform: 'uppercase', padding: '0 8px', marginBottom: 6 }}>
            Navigation
          </p>
          {NAV.filter(item => !item.adminOnly || userRole === 'admin').map(item => {
            const active = activePage === item.id
            return (
              <button key={item.id} onClick={() => onNavigate(item.id)} style={{
                width: '100%', textAlign: 'left',
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 10px', borderRadius: 'var(--radius-sm)', marginBottom: 2,
                background: active ? 'var(--accent-dim)' : 'transparent',
                border: `1px solid ${active ? 'var(--color-accent)' : 'transparent'}`,
                color: active ? 'var(--color-accent)' : 'var(--text-muted)',
                cursor: 'pointer', fontSize: 13, fontFamily: 'var(--font-heading)',
                fontWeight: active ? 600 : 400, transition: 'all .15s',
              }}
                onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'var(--color-text)' }}}
                onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}}
              >
                <span style={{ opacity: active ? 1 : 0.6 }}>{item.icon}</span>
                {item.label}
              </button>
            )
          })}
        </nav>

        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
          <p style={{ color: 'var(--text-dim)', fontSize: 9, fontFamily: 'var(--font-body)' }}>© 2026 LinuxWatch</p>
        </div>
      </div>
    </GlassSurface>
  )
})
