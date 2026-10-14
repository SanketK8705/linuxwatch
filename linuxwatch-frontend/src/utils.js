import { API_BASE } from './constants'

export const getUsername = () => localStorage.getItem('lw_user')
export const getUserRole  = () => localStorage.getItem('lw_role') || 'user'
export const getToken = () => localStorage.getItem('lw_token')

export const saveAuth = (username, role = 'user', token = null) => {
  localStorage.setItem('lw_user', username)
  localStorage.setItem('lw_role', role)
  if (token) localStorage.setItem('lw_token', token)
}

export const clearAuth = async () => {
  localStorage.removeItem('lw_user')
  localStorage.removeItem('lw_role')
  localStorage.removeItem('lw_token')
  try {
    await fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' })
  } catch {}
}

export const fetchOpts = (opts = {}) => ({
  credentials: 'include',
  ...opts,
  headers: {
    'Content-Type': 'application/json',
    ...(opts.headers || {}),
  },
})

export const authHeaders = () => ({ 'Content-Type': 'application/json' })

export async function checkAuth() {
  try {
    const res = await fetch(`${API_BASE}/auth/me`, fetchOpts())
    if (!res.ok) return null
    const data = await res.json()
    saveAuth(data.username, data.role, data.token)
    return data
  } catch {
    return null
  }
}

export const fmt = {
  time: ts => new Date(ts).toLocaleTimeString('en-US', { hour12: false }),
  date: ts => new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }),
  ago:  ts => {
    const s = Math.floor((Date.now() - new Date(ts)) / 1000)
    if (s < 60)   return `${s}s ago`
    if (s < 3600) return `${Math.floor(s/60)}m ago`
    return `${Math.floor(s/3600)}h ago`
  }
}
