export default function PlaceholderPage({ name }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🚧</div>
        <p style={{ fontWeight: 700, fontSize: 16, textTransform: 'capitalize' }}>{name}</p>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4, fontFamily: 'var(--font-mono)' }}>Coming soon</p>
      </div>
    </div>
  )
}