import BorderGlow from './BorderGlow'

export default function StatCard({ label, value, sub, color, glowColors, pulse = false }) {
  return (
    <BorderGlow
      borderRadius={4}
      glowRadius={24}
      glowColor="24 90 47"
      colors={glowColors || ['var(--color-accent)', 'var(--color-accent-secondary)', 'var(--color-accent)']}
      pulse={pulse}
      style={{ height: '100%' }}
    >
      <div style={{ padding: '14px 16px', position: 'relative' }}>
        <p style={{
          color: 'var(--text-dim)', fontSize: 10, fontFamily: 'var(--font-body)',
          letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10,
        }}>
          {label}
        </p>
        <p className="mono-num" style={{
          fontSize: 30, fontWeight: 800, color: color || 'var(--color-text-heading)',
          lineHeight: 1, fontFamily: 'var(--font-body)',
        }}>
          {value ?? '—'}
        </p>
        {sub && (
          <p style={{ color: 'var(--text-dim)', fontSize: 10, fontFamily: 'var(--font-body)', marginTop: 6 }}>{sub}</p>
        )}
      </div>
    </BorderGlow>
  )
}
