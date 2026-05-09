import { useEffect, useRef, useState, useCallback } from 'react'
import { io } from 'socket.io-client'
import { SOCKET_URL, API_BASE } from '../constants'
import { authHeaders, getToken } from '../utils'

function getUserIdFromToken() {
  try {
    const token = getToken() // uses correct key 'lw_token'
    if (!token) return null
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.id ?? payload.userId ?? payload.sub ?? null
  } catch {
    return null
  }
}

export default function useSocket() {
  const socketRef = useRef(null)
  const [connected, setConnected]     = useState(false)
  const [alerts, setAlerts]           = useState([])
  const [newAlertIds, setNewAlertIds] = useState(new Set())
  const [loading, setLoading]         = useState(true)

  const fetchAlerts = useCallback(async (filters = {}) => {
    setLoading(true)
    try {
      const params = new URLSearchParams(filters).toString()
      const res = await fetch(`${API_BASE}/alerts${params ? '?' + params : ''}`, { headers: authHeaders() })
      if (res.ok) {
        const data = await res.json()
        setAlerts(data)
      }
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchAlerts()

    socketRef.current = io(SOCKET_URL, { transports: ['websocket'] })

    socketRef.current.on('connect', () => {
      setConnected(true)
      const userId = getUserIdFromToken()
      if (userId) socketRef.current.emit('join_room', userId)
    })

    socketRef.current.on('disconnect', () => setConnected(false))

    socketRef.current.on('new_alert', (alert) => {
      setAlerts(prev => [alert, ...prev])
      setNewAlertIds(prev => new Set([...prev, alert.id]))
      setTimeout(() => {
        setNewAlertIds(prev => { const n = new Set(prev); n.delete(alert.id); return n })
      }, 3000)
    })

    return () => socketRef.current?.disconnect()
  }, [fetchAlerts])

  // FIX: update single alert status in-place instead of re-fetching all
  const updateAlertStatus = useCallback((id, status) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, status } : a))
  }, [])

  const refreshAlerts = useCallback((filters = {}) => {
    fetchAlerts(filters)
  }, [fetchAlerts])

  return { connected, alerts, newAlertIds, loading, refreshAlerts, updateAlertStatus }
}