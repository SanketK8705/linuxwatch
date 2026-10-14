import { useEffect, useState } from 'react'
import { checkAuth } from './utils'
import LoginPage from './pages/LoginPage'
import Layout from './pages/Layout'

export default function App() {
  const [authed, setAuthed] = useState(null)

  useEffect(() => {
    checkAuth().then(user => setAuthed(!!user))
  }, [])

  if (authed === null) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)', color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontSize: 12 }}>
        Loading…
      </div>
    )
  }

  return authed
    ? <Layout onLogout={() => setAuthed(false)} />
    : <LoginPage onLogin={() => setAuthed(true)} />
}
