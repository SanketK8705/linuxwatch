import { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo, memo } from 'react'
import { io } from 'socket.io-client'
import { SOCKET_URL, API_BASE } from '../constants'
import { fetchOpts, checkAuth } from '../utils'

const SocketContext = createContext(null)

export function SocketProvider({ children }) {
  const socketRef = useRef(null)
  const userIdRef = useRef(null)
  const [connected, setConnected] = useState(false)
  const [alerts, setAlerts] = useState([])
  const [newAlertIds, setNewAlertIds] = useState(() => new Set())
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState('user')
  const [critCount, setCritCount] = useState(0)
  const [lowMedCount, setLowMedCount] = useState(0)

  const applyCounts = useCallback((list) => {
    let crit = 0
    let low = 0
    for (const a of list) {
      if (a.severity === 'CRITICAL') crit++
      else if (a.severity === 'LOW' || a.severity === 'MEDIUM') low++
    }
    setCritCount(crit)
    setLowMedCount(low)
  }, [])

  const bumpCounts = useCallback((alert) => {
    if (alert.severity === 'CRITICAL') setCritCount(c => c + 1)
    else if (alert.severity === 'LOW' || alert.severity === 'MEDIUM') setLowMedCount(c => c + 1)
  }, [])

  const fetchAlerts = useCallback(async (filters = {}) => {
    setLoading(true)
    try {
      const params = new URLSearchParams(filters).toString()
      const res = await fetch(`${API_BASE}/alerts${params ? '?' + params : ''}`, fetchOpts())
      if (res.ok) {
        const data = await res.json()
        setAlerts(data)
        applyCounts(data)
      }
    } catch {}
    setLoading(false)
  }, [applyCounts])

  useEffect(() => {
    let cancelled = false

    async function init() {
      const user = await checkAuth()
      if (!user || cancelled) return
      userIdRef.current = user.id
      setUserRole(user.role || 'user')
      await fetchAlerts()

      socketRef.current = io(SOCKET_URL, { transports: ['websocket'], withCredentials: true })

      socketRef.current.on('connect', () => {
        setConnected(true)
        if (userIdRef.current) socketRef.current.emit('join_room', userIdRef.current)
      })

      socketRef.current.on('disconnect', () => setConnected(false))

      socketRef.current.on('new_alert', (alert) => {
        setAlerts(prev => [alert, ...prev])
        bumpCounts(alert)
        setNewAlertIds(prev => {
          const next = new Set(prev)
          next.add(alert.id)
          return next
        })
        setTimeout(() => {
          setNewAlertIds(prev => {
            const next = new Set(prev)
            next.delete(alert.id)
            return next
          })
        }, 3000)
      })
    }

    init()
    return () => {
      cancelled = true
      socketRef.current?.disconnect()
    }
  }, [fetchAlerts])

  const updateAlertStatus = useCallback((id, status) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, status } : a))
  }, [])

  const refreshAlerts = useCallback((filters = {}) => {
    fetchAlerts(filters)
  }, [fetchAlerts])

  const connectionValue = useMemo(() => ({
    connected, critCount, lowMedCount, userRole,
  }), [connected, critCount, lowMedCount, userRole])

  const alertsValue = useMemo(() => ({
    alerts,
    newAlertIds,
    loading,
    refreshAlerts,
    updateAlertStatus,
  }), [alerts, newAlertIds, loading, refreshAlerts, updateAlertStatus])

  return (
    <SocketContext.Provider value={{ connectionValue, alertsValue }}>
      {children}
    </SocketContext.Provider>
  )
}

export function useConnection() {
  const ctx = useContext(SocketContext)
  if (!ctx) throw new Error('useConnection must be used within SocketProvider')
  return ctx.connectionValue
}

export function useAlerts() {
  const ctx = useContext(SocketContext)
  if (!ctx) throw new Error('useAlerts must be used within SocketProvider')
  return ctx.alertsValue
}

/** @deprecated prefer useAlerts / useConnection for scoped subscriptions */
export default function useSocket() {
  const connection = useConnection()
  const alerts = useAlerts()
  return { ...connection, ...alerts }
}

export const DisconnectBanner = memo(function DisconnectBanner() {
  const { connected } = useConnection()
  if (connected) return null
  return (
    <div className="disconnect-banner">
      Live feed disconnected — retrying…
    </div>
  )
})
