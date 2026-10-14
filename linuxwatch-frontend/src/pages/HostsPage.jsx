import { useMemo, memo } from 'react'
import PageHeader from '../components/PageHeader'
import BorderGlow from '../components/BorderGlow'
import { useAlerts } from '../context/SocketContext'

const STATUS_META = {
  online:   { label: 'ONLINE',   color: 'var(--green)' },
  degraded: { label: 'DEGRADED', color: 'var(--color-accent)' },
  offline:  { label: 'OFFLINE',  color: 'var(--color-accent)' },
}

export default memo(function HostsPage() {
  const { alerts } = useAlerts()
  const hosts = useMemo(() => {
    const map = new Map()
    alerts.forEach(a => {
      const ip = a.source_ip || 'unknown'
      if (!map.has(ip)) {
        map.set(ip, { ip, alertCount: 0, maxSev: 'LOW', lastSeen: a.created_at })
      }
      const h = map.get(ip)
      h.alertCount++
      if (a.created_at > h.lastSeen) h.lastSeen = a.created_at
      const sevOrder = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 }
      if ((sevOrder[a.severity] || 0) > (sevOrder[h.maxSev] || 0)) h.maxSev = a.severity
    })

    return [...map.values()].map(h => ({
      ...h,
      status: h.maxSev === 'CRITICAL' || h.maxSev === 'HIGH' ? 'degraded'
        : h.alertCount > 5 ? 'degraded' : h.alertCount > 0 ? 'online' : 'online',
      hostname: h.ip === 'unknown' ? 'unresolved' : `host-${h.ip.split('.').slice(-1)[0]}`,
    })).slice(0, 12)
  }, [alerts])

  if (hosts.length === 0) {
    return (
      <div className="animate-fade-in">
        <PageHeader title="Hosts" subtitle="Monitored infrastructure endpoints" />
        <div style={{ padding: '48px 0', textAlign: 'center' }}>
          <p style={{ color: 'var(--color-accent-secondary)', fontSize: 24, marginBottom: 8 }}>◌</p>
          <p style={{ color: 'var(--text-muted)', fontSize: 12, fontFamily: 'var(--font-body)' }}>
            No host activity recorded yet
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="animate-fade-in">
      <PageHeader title="Hosts" subtitle={`${hosts.length} endpoint${hosts.length !== 1 ? 's' : ''} with activity`} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
        {hosts.map(host => {
          const meta = STATUS_META[host.status]
          const pulse = host.status === 'degraded' || host.status === 'offline'
          return (
            <BorderGlow
              key={host.ip}
              borderRadius={4}
              glowRadius={20}
              glowColor={pulse ? '24 90 47' : '200 80 50'}
              pulse={pulse}
              colors={pulse
                ? ['var(--color-accent)', '#ff6b2b', 'var(--color-accent)']
                : ['var(--color-accent-secondary)', '#38bdf8', 'var(--color-accent-secondary)']}
            >
              <div style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-text-heading)', fontWeight: 600 }}>
                    {host.hostname}
                  </span>
                  <span style={{
                    fontSize: 9, fontFamily: 'var(--font-body)', letterSpacing: '0.08em',
                    color: meta.color, border: `1px solid ${meta.color}44`, padding: '2px 6px',
                    borderRadius: 'var(--radius-sm)',
                  }}>
                    {meta.label}
                  </span>
                </div>
                <p className="mono-num" style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-body)', marginBottom: 8 }}>
                  {host.ip}
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontFamily: 'var(--font-body)', color: 'var(--text-dim)' }}>
                  <span>{host.alertCount} alerts</span>
                  <span style={{ color: host.maxSev === 'CRITICAL' || host.maxSev === 'HIGH' ? 'var(--color-accent)' : 'var(--color-accent-secondary)' }}>
                    {host.maxSev}
                  </span>
                </div>
              </div>
            </BorderGlow>
          )
        })}
      </div>
    </div>
  )
})
