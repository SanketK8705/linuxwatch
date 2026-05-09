import { useState } from 'react'
import Sidebar from '../components/Sidebar'
import Topbar from '../components/Topbar'
import DashboardPage from './DashboardPage'
import AlertsPage from './AlertsPage'
import EventsPage from './EventsPage'
import RulesPage from './RulesPage'
import StatsPage from './StatsPage'
import useSocket from '../hooks/useSocket'
import { clearAuth, getUsername } from '../utils'

export default function Layout({ onLogout }) {
  const [page, setPage] = useState('dashboard')
  const { connected, alerts, newAlertIds, loading, refreshAlerts, updateAlertStatus } = useSocket()

  const handleLogout = () => { clearAuth(); onLogout() }

  const renderPage = () => {
    if (page === 'dashboard') return (
      <DashboardPage
        alerts={alerts}
        newAlertIds={newAlertIds}
        isConnected={connected}
        onStatusUpdate={updateAlertStatus}
      />
    )
    if (page === 'alerts') return (
      <AlertsPage
        alerts={alerts}
        loading={loading}
        onRefresh={refreshAlerts}
        onStatusUpdate={updateAlertStatus}
      />
    )
    if (page === 'events') return <EventsPage />
    if (page === 'stats')  return <StatsPage />
    if (page === 'rules')  return <RulesPage />
    return null
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar activePage={page} onNavigate={setPage} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Topbar connected={connected} username={getUsername()} onLogout={handleLogout} />
        <main style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {renderPage()}
        </main>
      </div>
    </div>
  )
}