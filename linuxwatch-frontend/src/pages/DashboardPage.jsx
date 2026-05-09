import StatCard from '../components/StatCard'
import LiveFeedSection from '../components/LiveFeedSection'
import AlertsTable from '../components/AlertsTable'
import { BACKEND } from '../constants'

export default function DashboardPage({ alerts, newAlertIds, isConnected, onStatusUpdate }) {
  const critCount  = alerts.filter(a => a.severity === 'CRITICAL').length
  const highCount  = alerts.filter(a => a.severity === 'HIGH').length
  const medCount   = alerts.filter(a => a.severity === 'MEDIUM').length
  const openCount  = alerts.filter(a => a.status === 'OPEN').length

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontWeight: 900, fontSize: 24, letterSpacing: '-0.5px', marginBottom: 4 }}>
            Dashboard
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            Real-time intrusion detection overview
          </p>
        </div>
        <div style={{
          fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)',
          background: 'var(--bg-panel)', border: '1px solid var(--border)',
          padding: '5px 12px', borderRadius: 6,
        }}>
          {alerts.length} total events
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        <StatCard label="Open Alerts"   value={openCount}  sub="unresolved"       color="var(--red)"    />
        <StatCard label="Critical"      value={critCount}  sub="immediate action" color="var(--red)"    />
        <StatCard label="High"          value={highCount}  sub="investigate soon" color="var(--orange)" />
        <StatCard label="Medium"        value={medCount}   sub="monitor"          color="var(--yellow)" />
      </div>

      {/* Main content */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 16 }}>
        <LiveFeedSection alerts={alerts.slice(0, 12)} newAlertIds={newAlertIds} />
        <div style={{
          background: 'var(--bg-panel)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-xl)', overflow: 'hidden',
        }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
            <h2 style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>
              Recent Alerts
            </h2>
          </div>
          <AlertsTable
            alerts={alerts.slice(0, 15)}
            onStatusUpdate={onStatusUpdate}
            compact
          />
        </div>
      </div>

      {!isConnected && (
        <div style={{
          marginTop: 16, padding: '10px 16px',
          background: 'var(--red-dim)', border: '1px solid var(--red)33',
          borderRadius: 'var(--radius)', color: 'var(--red)',
          fontFamily: 'var(--font-mono)', fontSize: 12,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          ⚠ Disconnected — ensure backend is running at {BACKEND}
        </div>
      )}
    </div>
  )
}