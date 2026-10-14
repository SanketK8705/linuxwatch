import StatCard from '../components/StatCard'
import LiveFeedSection from '../components/LiveFeedSection'
import AlertsTable from '../components/AlertsTable'
import PageHeader from '../components/PageHeader'
import GlassSurface from '../components/GlassSurface'
import { useAlerts, useConnection } from '../context/SocketContext'
import { memo } from 'react'

function DashboardPage() {
  const { alerts, newAlertIds, updateAlertStatus } = useAlerts()
  const { connected } = useConnection()

  const critCount  = alerts.filter(a => a.severity === 'CRITICAL' || a.severity === 'HIGH').length
  const openCount  = alerts.filter(a => a.status === 'OPEN').length
  const uniqueIPs  = new Set(alerts.map(a => a.source_ip).filter(Boolean)).size
  const uptimePct  = connected ? '99.9' : '—'

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Dashboard"
        subtitle="Real-time intrusion detection overview"
        action={
          <span className="mono-num" style={{
            fontSize: 10, fontFamily: 'var(--font-body)', color: 'var(--text-dim)',
            background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)',
            padding: '4px 10px', borderRadius: 'var(--radius-sm)',
          }}>
            {alerts.length} total alerts
          </span>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
        <StatCard label="Active Threats" value={openCount} sub="unresolved" color="var(--color-accent)" />
        <StatCard label="Blocked IPs" value={uniqueIPs} sub="unique sources" color="var(--color-accent)" />
        <StatCard label="Log Volume" value={alerts.length} sub="alert events" color="var(--color-text-heading)" />
        <StatCard label="Uptime" value={uptimePct} sub={connected ? 'feed active' : 'feed down'} color="var(--color-accent-secondary)" pulse={!connected} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 12 }}>
        <LiveFeedSection alerts={alerts.slice(0, 12)} newAlertIds={newAlertIds} />
        <GlassSurface width="100%" borderRadius={4} backgroundOpacity={0.4} style={{ overflow: 'hidden' }}>
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
            <h2 style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--text-muted)', fontFamily: 'var(--font-body)', textTransform: 'uppercase' }}>
              Recent Alerts
            </h2>
          </div>
          <AlertsTable alerts={alerts.slice(0, 15)} onStatusUpdate={updateAlertStatus} compact />
        </GlassSurface>
      </div>

      <div style={{ marginTop: 12, display: 'flex', gap: 16, fontSize: 10, fontFamily: 'var(--font-body)', color: 'var(--text-dim)' }}>
        <span>🟠 critical/high: <span className="mono-num" style={{ color: 'var(--color-accent)' }}>{critCount}</span></span>
        <span>🔵 low/med: <span className="mono-num" style={{ color: 'var(--color-accent-secondary)' }}>{alerts.filter(a => a.severity === 'LOW' || a.severity === 'MEDIUM').length}</span></span>
      </div>
    </div>
  )
}

export default memo(DashboardPage)
