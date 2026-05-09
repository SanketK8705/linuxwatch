import { SEV_META } from '../constants'

export default function SeverityBadge({ severity }) {
  const m = SEV_META[severity] || SEV_META.LOW
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '2px 8px', borderRadius: 4,
      background: m.dim, color: m.color,
      fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700,
      border: `1px solid ${m.color}30`,
      letterSpacing: '0.06em',
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: m.color, boxShadow: `0 0 4px ${m.color}` }} />
      {severity}
    </span>
  )
}