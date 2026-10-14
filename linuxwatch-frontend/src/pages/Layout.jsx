import { memo, useState } from 'react'
import LiquidEtherBackground from '../components/LiquidEtherBackground'
import Sidebar from '../components/Sidebar'
import Topbar from '../components/Topbar'
import { SocketProvider, DisconnectBanner, useConnection } from '../context/SocketContext'
import { clearAuth, getUsername } from '../utils'
import DashboardPage from '../pages/DashboardPage'
import AlertsPage from '../pages/AlertsPage'
import EventsPage from '../pages/EventsPage'
import RulesPage from '../pages/RulesPage'
import StatsPage from '../pages/StatsPage'
import HostsPage from '../pages/HostsPage'
import SettingsPage from '../pages/SettingsPage'
import AIPage from '../pages/AIPage'
import UsersPage from '../pages/UsersPage'

const TopbarConnected = memo(function TopbarConnected({ onLogout }) {
  const { connected, critCount, lowMedCount, userRole } = useConnection()
  return (
    <Topbar
      connected={connected}
      username={getUsername()}
      userRole={userRole}
      onLogout={onLogout}
      critCount={critCount}
      lowMedCount={lowMedCount}
    />
  )
})

const PageRouter = memo(function PageRouter({ page, userRole }) {
  switch (page) {
    case 'dashboard': return <DashboardPage />
    case 'alerts':    return <AlertsPage />
    case 'events':    return <EventsPage />
    case 'stats':     return <StatsPage />
    case 'rules':     return <RulesPage />
    case 'ai':        return <AIPage />
    case 'hosts':     return <HostsPage />
    case 'settings':  return <SettingsPage username={getUsername()} />
    case 'users':     return userRole === 'admin' ? <UsersPage /> : null
    default:          return null
  }
})

const LayoutShell = memo(function LayoutShell({ page, setPage, onLogout }) {
  const { userRole } = useConnection()
  return (
    <div style={{ position: 'relative', height: '100vh', overflow: 'hidden', background: 'var(--color-bg)' }}>
      <LiquidEtherBackground />
      <div style={{ display: 'flex', height: '100%', position: 'relative', zIndex: 1 }}>
        <Sidebar activePage={page} onNavigate={setPage} userRole={userRole} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          <TopbarConnected onLogout={onLogout} />
          <DisconnectBanner />
          <main style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
            <PageRouter page={page} userRole={userRole} />
          </main>
        </div>
      </div>
    </div>
  )
})

export default function Layout({ onLogout }) {
  const [page, setPage] = useState('dashboard')
  const handleLogout = async () => { await clearAuth(); onLogout() }

  return (
    <SocketProvider>
      <LayoutShell page={page} setPage={setPage} onLogout={handleLogout} />
    </SocketProvider>
  )
}
