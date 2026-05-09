import { useState } from 'react'
import { API_BASE } from '../constants'
import { saveAuth } from '../utils'

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
      const res  = await fetch(`${API_BASE}/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user, password: pass }),
      })
      const data = await res.json()
      if (!res.ok) { setErr(data.error || 'Failed'); setBusy(false); return }
      if (mode === 'register') { setMode('login'); setErr(''); setBusy(false); return }
      saveAuth(data.token, data.username)
      onLogin()
    } catch {
      setErr('Cannot reach backend — is it running?')
      setBusy(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      background: 'var(--bg)',
    }}>
      {/* Left panel — branding */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        justifyContent: 'center', padding: '60px 80px',
        position: 'relative',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 60 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: 'var(--accent-dim)', border: '1px solid var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 20px var(--accent-glow)',
          }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--accent-2)" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <span style={{ fontWeight: 800, fontSize: 20, letterSpacing: '-0.3px' }}>
            Linux<span className="grad-text">Watch</span>
          </span>
        </div>

        <h2 style={{ fontWeight: 900, fontSize: 42, lineHeight: 1.1, letterSpacing: '-1px', marginBottom: 16 }}>
          Intrusion<br />
          <span className="grad-text">Detection</span><br />
          System
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 15, lineHeight: 1.6, maxWidth: 340, marginBottom: 48 }}>
          Real-time threat monitoring and alerting for your Linux infrastructure.
        </p>

        {/* Feature bullets */}
        {[
          { icon: '⬡', label: 'Live alert feed', desc: 'Instant socket-based notifications' },
          { icon: '◈', label: 'Multi-attack detection', desc: '16 rules across 9 attack types' },
          { icon: '⌁', label: 'Per-user isolation', desc: 'Your alerts, only yours' },
        ].map(f => (
          <div key={f.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 20 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 8, flexShrink: 0,
              background: 'var(--accent-dim)', border: '1px solid var(--accent)30',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, color: 'var(--accent-2)',
            }}>
              {f.icon}
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{f.label}</p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{f.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Right panel — login card */}
      <div style={{
        width: 460, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 40, borderLeft: '1px solid var(--border)',
        background: 'var(--bg-panel)',
      }}>
        <div style={{ width: '100%', maxWidth: 380 }}>
          <h3 style={{ fontWeight: 800, fontSize: 22, marginBottom: 6, letterSpacing: '-0.3px' }}>
            {mode === 'login' ? 'Welcome back' : 'Create account'}
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 32, fontFamily: 'var(--font-mono)' }}>
            {mode === 'login' ? 'Sign in to access your dashboard' : 'Register a new account'}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Field label="Username" value={user} onChange={setUser} placeholder="admin" onEnter={submit} />
            <Field label="Password" value={pass} onChange={setPass} placeholder="••••••••" type="password" onEnter={submit} />
          </div>

          {err && (
            <p style={{ color: 'var(--red)', fontSize: 12, fontFamily: 'var(--font-mono)', marginTop: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>✗</span> {err}
            </p>
          )}

          <button onClick={submit} disabled={busy} style={{
            width: '100%', marginTop: 24, padding: '12px 0',
            background: busy ? 'var(--border)' : 'linear-gradient(135deg, var(--accent), var(--accent-2))',
            color: busy ? 'var(--text-muted)' : '#fff',
            border: 'none', borderRadius: 'var(--radius)',
            fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: 14,
            cursor: busy ? 'not-allowed' : 'pointer',
            transition: 'opacity .15s',
            boxShadow: busy ? 'none' : '0 0 24px var(--accent-glow)',
            letterSpacing: '0.02em',
          }}
            onMouseEnter={e => { if (!busy) e.currentTarget.style.opacity = '0.9' }}
            onMouseLeave={e => { if (!busy) e.currentTarget.style.opacity = '1' }}
          >
            {busy ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Register'}
          </button>

          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
              {mode === 'login' ? "No account? " : 'Have an account? '}
            </span>
            <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setErr('') }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', fontSize: 12,
                fontFamily: 'var(--font-ui)', fontWeight: 600,
                background: 'var(--accent-grad)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>
              {mode === 'login' ? 'Register' : 'Sign In'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, placeholder, type = 'text', onEnter }) {
  return (
    <div>
      <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 11, marginBottom: 7, fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        {label}
      </label>
      <input
        type={type} value={value} placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && onEnter()}
        style={{
          width: '100%', padding: '10px 14px',
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', color: 'var(--text)',
          fontFamily: 'var(--font-mono)', fontSize: 13, outline: 'none',
          transition: 'border-color .15s',
        }}
        onFocus={e => e.target.style.borderColor = 'var(--accent)'}
        onBlur={e  => e.target.style.borderColor = 'var(--border)'}
      />
    </div>
  )
}