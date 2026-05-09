export default function StatCard({ label, value, sub, color, icon }) {
  return (
    <div style={{
      background: 'var(--bg-panel)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)', padding: '18px 20px',
      transition: 'all .2s', position: 'relative', overflow: 'hidden',
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-light)'; e.currentTarget.style.background = 'var(--bg-card)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-panel)' }}
    >
      {/* Subtle glow in corner */}
      <div style={{
        position: 'absolute', top: 0, right: 0,
        width: 80, height: 80, borderRadius: '50%',
        background: (color || 'var(--accent)') + '0d',
        transform: 'translate(30%, -30%)',
        pointerEvents: 'none',
      }} />
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <p style={{ color: 'var(--text-dim)', fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {label}
        </p>
        {icon && (
          <span style={{ color: color || 'var(--accent)', opacity: 0.7 }}>{icon}</span>
        )}
      </div>
      <p style={{ fontSize: 34, fontWeight: 800, color: color || 'var(--text)', lineHeight: 1, fontFamily: 'var(--font-ui)' }}>
        {value ?? '—'}
      </p>
      {sub && (
        <p style={{ color: 'var(--text-dim)', fontSize: 11, fontFamily: 'var(--font-mono)', marginTop: 8 }}>{sub}</p>
      )}
    </div>
  )
}