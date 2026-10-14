import BlurText from './BlurText'

export default function PageHeader({ title, subtitle, action }) {
  return (
    <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
      <div>
        <BlurText
          text={title}
          as="h1"
          className="page-title"
          delay={60}
          style={{ fontWeight: 800, fontSize: 24, letterSpacing: '-0.5px', color: 'var(--color-text-heading)', fontFamily: 'var(--font-heading)' }}
        />
        {subtitle && (
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  )
}
