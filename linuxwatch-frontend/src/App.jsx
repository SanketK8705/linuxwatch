import { useState } from 'react'
import { isAuthed } from './utils'
import LoginPage from './pages/LoginPage'
import Layout from './pages/Layout'

export default function App() {
  const [authed, setAuthed] = useState(isAuthed())
  return authed
    ? <Layout onLogout={() => setAuthed(false)} />
    : <LoginPage onLogin={() => setAuthed(true)} />
}