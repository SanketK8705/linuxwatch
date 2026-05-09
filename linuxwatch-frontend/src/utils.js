export const getToken    = ()           => localStorage.getItem('lw_token')
export const getUsername = ()           => localStorage.getItem('lw_user')
export const saveAuth    = (tok, user)  => { localStorage.setItem('lw_token', tok); localStorage.setItem('lw_user', user) }
export const clearAuth   = ()           => { localStorage.removeItem('lw_token'); localStorage.removeItem('lw_user') }
export const isAuthed    = ()           => !!getToken()
export const authHeaders = ()           => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` })

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