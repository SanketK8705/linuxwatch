import { useEffect, useState } from 'react'
import PageHeader from '../components/PageHeader'
import GlassSurface from '../components/GlassSurface'
import { API_BASE } from '../constants'
import { fetchOpts } from '../utils'

export default function UsersPage() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(null)

  const loadUsers = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`${API_BASE}/users`, fetchOpts())
      if (!response.ok) throw new Error('Unable to load accounts')
      setUsers(await response.json())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadUsers() }, [])

  const changeRole = async (user, role) => {
    setSaving(user.id)
    setError('')
    try {
      const response = await fetch(`${API_BASE}/users/${user.id}/role`, fetchOpts({
        method: 'PATCH',
        body: JSON.stringify({ role }),
      }))
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to update role')
      setUsers(current => current.map(item => item.id === data.id ? data : item))
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="animate-fade-in">
      <PageHeader title="Users" subtitle="Manage account access and monitoring ownership" />
      {error && <p style={{ color: 'var(--color-accent)', fontSize: 12, marginBottom: 12 }}>{error}</p>}
      <GlassSurface width="100%" borderRadius={4} backgroundOpacity={0.45} style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 44, color: 'var(--text-muted)', textAlign: 'center' }}>Loading accounts...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['Account', 'Role', 'Created', 'Access'].map(label => (
                <th key={label} style={headerStyle}>{label}</th>
              ))}</tr></thead>
              <tbody>{users.map(user => (
                <tr key={user.id}>
                  <td style={cellStyle}>
                    <strong style={{ color: 'var(--color-text)' }}>{user.username}</strong>
                    <span style={{ display: 'block', color: 'var(--text-dim)', fontSize: 10 }}>ID {user.id}</span>
                  </td>
                  <td style={cellStyle}>
                    <span style={{
                      display: 'inline-block', padding: '3px 7px', borderRadius: 4,
                      color: user.role === 'admin' ? 'var(--color-accent)' : 'var(--color-accent-secondary)',
                      border: `1px solid ${user.role === 'admin' ? 'var(--color-accent)' : 'var(--color-accent-secondary)'}`,
                      fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase',
                    }}>
                      {user.role}
                    </span>
                  </td>
                  <td style={{ ...cellStyle, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td style={cellStyle}>
                    <button
                      className="btn-secondary"
                      disabled={saving === user.id}
                      onClick={() => changeRole(user, user.role === 'admin' ? 'user' : 'admin')}
                      style={{ fontSize: 10, padding: '5px 9px' }}
                    >
                      {saving === user.id ? 'saving...' : user.role === 'admin' ? 'make user' : 'make admin'}
                    </button>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </GlassSurface>
    </div>
  )
}

const headerStyle = {
  padding: '10px 16px', textAlign: 'left', color: 'var(--text-dim)',
  fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em',
  textTransform: 'uppercase', borderBottom: '1px solid var(--border)',
}

const cellStyle = {
  padding: '12px 16px', borderBottom: '1px solid var(--border)',
  fontSize: 12, fontFamily: 'var(--font-body)',
}