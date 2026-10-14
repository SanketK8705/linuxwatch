import { useState } from 'react'
import PageHeader from '../components/PageHeader'
import GlassSurface from '../components/GlassSurface'

export default function SettingsPage({ username }) {
  const [email, setEmail] = useState(`${username || 'user'}@linuxwatch.local`)
  const [critAlerts, setCritAlerts] = useState(true)
  const [medAlerts, setMedAlerts] = useState(true)
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="animate-fade-in" style={{ maxWidth: 520 }}>
      <PageHeader title="Settings" subtitle="Account and notification preferences" />

      <GlassSurface width="100%" borderRadius={4} backgroundOpacity={0.45}>
        <div style={{ padding: '16px 18px' }}>
          <Section title="Account">
            <Field label="Username" value={username || ''} readOnly />
            <Field label="Email" value={email} onChange={setEmail} />
          </Section>

          <Section title="Notifications">
            <Toggle label="Critical & high severity alerts" checked={critAlerts} onChange={setCritAlerts} />
            <Toggle label="Low & medium severity alerts" checked={medAlerts} onChange={setMedAlerts} />
          </Section>

          <button className="btn-primary" onClick={handleSave} style={{ marginTop: 20, padding: '10px 24px', fontSize: 13 }}>
            {saved ? 'Saved' : 'Save'}
          </button>
        </div>
      </GlassSurface>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h3 style={{ fontSize: 10, fontFamily: 'var(--font-body)', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 12 }}>
        {title}
      </h3>
      {children}
    </div>
  )
}

function Field({ label, value, onChange, readOnly }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 10, fontFamily: 'var(--font-body)', color: 'var(--text-muted)', marginBottom: 5, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        {label}
      </label>
      <input
        value={value}
        readOnly={readOnly}
        onChange={e => onChange?.(e.target.value)}
        style={{
          width: '100%', padding: '8px 10px',
          background: 'var(--color-bg)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)', color: 'var(--color-text)',
          fontFamily: 'var(--font-body)', fontSize: 12, outline: 'none',
          opacity: readOnly ? 0.6 : 1,
        }}
      />
    </div>
  )
}

function Toggle({ label, checked, onChange }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', cursor: 'pointer' }}>
      <span style={{ fontSize: 12, fontFamily: 'var(--font-body)', color: 'var(--color-text)' }}>{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        style={{
          width: 36, height: 20, borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer',
          background: checked ? 'var(--color-accent)' : 'var(--border)',
          position: 'relative', transition: 'background 0.15s',
        }}
      >
        <span style={{
          position: 'absolute', top: 2, left: checked ? 18 : 2,
          width: 16, height: 16, borderRadius: 'var(--radius-sm)',
          background: 'var(--color-text-heading)', transition: 'left 0.15s',
        }} />
      </button>
    </label>
  )
}
