import { useState } from 'react'
import { API_BASE } from '../constants'
import { saveAuth, fetchOpts } from '../utils'
import MoltenMetal from '../components/MoltenMetal'
import SpotlightCard from '../components/SpotlightCard'
import BlurText from '../components/BlurText'

export default function LoginPage({ onLogin }) {
  const [mode, setMode] = useState('login')
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [err,  setErr]  = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!user || !pass) return setErr('Fill in both fields')
    setBusy(true); setErr('')
    try {
      const res  = await fetch(`${API_BASE}/auth/${mode}`, fetchOpts({
        method: 'POST',
        body: JSON.stringify({ username: user, password: pass }),
      }))
      const data = await res.json()
      if (!res.ok) { setErr(data.error || 'Failed'); setBusy(false); return }
      if (mode === 'register') { setMode('login'); setErr(''); setBusy(false); return }
      saveAuth(data.username, data.role, data.token)
      onLogin()
    } catch {
      setErr('Cannot reach backend — is it running?')
      setBusy(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'fixed', inset: 0, zIndex: 0 }}>
        <MoltenMetal
          color1="#1a0800"
          color2="#e8590c"
          color3="#ffd4a8"
          speed={0.25}
          scale={4}
          detail={2}
          glow={1.2}
          brightness={1.0}
          opacity={0.95}
          grain={false}
          dpr={1}
          mouseInteraction
          mouseStrength={0.2}
        />
      </div>

      <div style={{
        position: 'relative', zIndex: 1, minHeight: '100vh',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}>
        <div style={{ marginBottom: 32, textAlign: 'center' }}>
          <BlurText text="LinuxWatch" className="page-title" delay={80} as="h1" />
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 8, fontFamily: 'var(--font-body)' }}>
            Intrusion Detection System
          </p>
        </div>

        <SpotlightCard
          spotlightColor="rgba(232, 89, 12, 0.12)"
          style={{ width: '100%', maxWidth: 400 }}
        >
          <h3 style={{ fontWeight: 700, fontSize: 18, marginBottom: 4, color: 'var(--color-text-heading)', fontFamily: 'var(--font-heading)' }}>
            {mode === 'login' ? 'Sign in' : 'Create account'}
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 24, fontFamily: 'var(--font-body)' }}>
            {mode === 'login' ? 'Access your security dashboard' : 'Register a new operator account'}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label="Username" value={user} onChange={setUser} placeholder="admin" onEnter={submit} />
            <Field label="Password" value={pass} onChange={setPass} placeholder="••••••••" type="password" onEnter={submit} />
          </div>

          {err && (
            <p style={{ color: 'var(--color-accent)', fontSize: 12, fontFamily: 'var(--font-body)', marginTop: 12 }}>
              ✗ {err}
            </p>
          )}

          <button
            onClick={submit}
            disabled={busy}
            className="btn-primary"
            style={{ width: '100%', marginTop: 20, padding: '11px 0', fontSize: 14 }}
          >
            {busy ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Register'}
          </button>

          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <button
              className="link-secondary"
              style={{ fontSize: 12, background: 'none', border: 'none' }}
              onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setErr('') }}
            >
              {mode === 'login' ? 'Create account' : 'Back to sign in'}
            </button>
          </div>

          {mode === 'login' && (
            <p style={{ textAlign: 'center', marginTop: 12 }}>
              <span className="link-secondary" style={{ fontSize: 11, cursor: 'default', opacity: 0.7 }}>
                Forgot password?
              </span>
            </p>
          )}
        </SpotlightCard>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, placeholder, type = 'text', onEnter }) {
  return (
    <div>
      <label style={{
        display: 'block', color: 'var(--text-muted)', fontSize: 10, marginBottom: 6,
        fontFamily: 'var(--font-body)', letterSpacing: '0.08em', textTransform: 'uppercase',
      }}>
        {label}
      </label>
      <input
        type={type} value={value} placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && onEnter()}
        style={{
          width: '100%', padding: '10px 12px',
          background: 'var(--color-bg)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)', color: 'var(--color-text)',
          fontFamily: 'var(--font-body)', fontSize: 13, outline: 'none',
          transition: 'border-color .15s',
        }}
        onFocus={e => e.target.style.borderColor = 'var(--color-accent)'}
        onBlur={e  => e.target.style.borderColor = 'var(--border)'}
      />
    </div>
  )
}
