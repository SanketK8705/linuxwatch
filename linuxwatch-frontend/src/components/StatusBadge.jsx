import { STATUS_META } from '../constants'

export default function StatusBadge({ status }) {
  const m = STATUS_META[status] || STATUS_META.OPEN
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 4,
      background: m.color + '18', color: m.color,
      fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700,
      border: `1px solid ${m.color}30`,
      letterSpacing: '0.06em',
    }}>
      {m.label}
    </span>
  )
}