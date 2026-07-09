"use client"

import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from "react"
import { toast } from "sonner"
import { useSocket } from "@/providers/socket-provider"
import { apiClient } from "@/lib/api/client"
import type { NotificationCategory } from "@/lib/services/notification-helpers"
import {
  ThermometerIcon,
  HumidityIcon,
  DropletIcon,
  LeafIcon,
  WindIcon,
  PhIcon,
  SunIcon,
  DeviceIcon,
  ShieldCheckIcon,
  LockIcon,
  UserIcon,
  GearIcon,
  BellIcon,
  CheckCircleIcon,
  XCircleIcon,
  AlertTriangleIcon,
  InfoIcon,
} from "@/components/icons/toast-icons"
import { X } from "lucide-react"

// ─── Icon Registry ───────────────────────────────────────────────
// Maps each notification category to its domain-specific SVG icon.

const CategoryIcons: Record<NotificationCategory, React.ReactNode> = {
  temperature: <ThermometerIcon className="toast-icon" />,
  humidity:    <HumidityIcon className="toast-icon" />,
  irrigation:  <DropletIcon className="toast-icon" />,
  soil:        <LeafIcon className="toast-icon" />,
  wind:        <WindIcon className="toast-icon" />,
  ph:          <PhIcon className="toast-icon" />,
  uv:          <SunIcon className="toast-icon" />,
  device:      <DeviceIcon className="toast-icon" />,
  security:    <ShieldCheckIcon className="toast-icon" />,
  auth:        <LockIcon className="toast-icon" />,
  profile:     <UserIcon className="toast-icon" />,
  system:      <GearIcon className="toast-icon" />,
  general:     <BellIcon className="toast-icon" />,
}

// Fallback type-based icons when no category is provided
const TypeIcons: Record<string, React.ReactNode> = {
  success: <CheckCircleIcon className="toast-icon" />,
  error:   <XCircleIcon className="toast-icon" />,
  warning: <AlertTriangleIcon className="toast-icon" />,
  info:    <InfoIcon className="toast-icon" />,
}

// ─── Color Schemes (hardcoded for inline style reliability) ─────
const typeColors = {
  success: { bg: '#ecfdf5', border: '#a7f3d0', icon: '#059669', iconBg: 'rgba(5, 150, 105, 0.12)', text: '#065f46' },
  error:   { bg: '#fef2f2', border: '#fecaca', icon: '#dc2626', iconBg: 'rgba(220, 38, 38, 0.12)', text: '#991b1b' },
  warning: { bg: '#fffbeb', border: '#fde68a', icon: '#d97706', iconBg: 'rgba(217, 119, 6, 0.12)', text: '#92400e' },
  info:    { bg: '#eff6ff', border: '#bfdbfe', icon: '#2563eb', iconBg: 'rgba(37, 99, 235, 0.12)', text: '#1e40af' },
}

// ─── Custom Toast Component ─────────────────────────────────────
function CustomToast({ 
  toastId,
  type, 
  title, 
  description, 
  category 
}: { 
  toastId: string | number
  type: 'info' | 'success' | 'warning' | 'error'
  title: string
  description?: string
  category?: NotificationCategory
}) {
  const colors = typeColors[type]
  const icon = category ? CategoryIcons[category] : TypeIcons[type]

  return (
    <div 
      className="hanjeli-toast"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        padding: '14px 16px',
        borderRadius: '16px',
        background: colors.bg,
        borderWidth: '1.5px',
        borderStyle: 'solid',
        borderColor: colors.border,
        boxShadow: '0 8px 32px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)',
        width: '400px', // Fixed width on desktop for uniformity
        maxWidth: 'calc(100vw - 32px)', // Responsive on mobile
        fontFamily: 'Lexend, system-ui, sans-serif',
        animation: 'toast-slide-in 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* Icon container */}
      <div 
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '36px',
          height: '36px',
          borderRadius: '10px',
          background: colors.iconBg,
          color: colors.icon,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>

      {/* Text content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p 
          style={{
            fontSize: '13.5px',
            fontWeight: 600,
            color: colors.text,
            margin: 0,
            lineHeight: 1.4,
          }}
        >
          {title}
        </p>
        {description && (
          <p 
            style={{
              fontSize: '12px',
              color: colors.text,
              opacity: 0.75,
              margin: '2px 0 0',
              lineHeight: 1.4,
            }}
          >
            {description}
          </p>
        )}
      </div>

      {/* Type indicator dot */}
      <div 
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: colors.icon,
          flexShrink: 0,
          marginTop: '6px',
          animation: type === 'error' || type === 'warning' ? 'toast-pulse 2s ease-in-out infinite' : 'none',
        }}
      />

      {/* Close button */}
      <button 
        onClick={() => toast.dismiss(toastId)}
        style={{
          padding: '4px',
          color: colors.text,
          opacity: 0.5,
          cursor: 'pointer',
          background: 'transparent',
          border: 'none',
          marginLeft: '-4px', // slight negative margin to balance
        }}
        aria-label="Tutup notifikasi"
      >
         <X size={16} />
      </button>
    </div>
  )
}

// ─── Notification Types ──────────────────────────────────────────
export interface AppNotification {
  id: string
  title: string
  description?: string
  date: string
  read: boolean
  type: 'info' | 'success' | 'warning' | 'error'
  category?: NotificationCategory
}

type BackendNotification = {
  id?: string
  title: string
  description?: string
  type?: AppNotification["type"]
  category?: NotificationCategory
  read?: boolean
  created_at?: string
}

type NotificationsResponse = {
  data?: BackendNotification[]
}

interface NotificationContextType {
  notifications: AppNotification[]
  unreadCount: number
  addNotification: (notification: Omit<AppNotification, 'id' | 'date' | 'read'>) => void
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  clearAll: () => void
  removeNotification: (id: string) => void
  isRinging: boolean
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

// ─── Duration config per type ────────────────────────────────────
const durationByType: Record<string, number> = {
  success: 3500,
  error: 6000,
  warning: 5000,
  info: 4000,
}

// Suppress duplicate notifications fired within this window (ms). Guards
// against React Strict Mode double-mounts, double-clicks, and backend retries
// that would otherwise stack identical toasts.
const DEDUPE_WINDOW_MS = 2000

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [isRinging, setIsRinging] = useState(false)
  const { socket } = useSocket()
  // Tracks recent notification keys → timestamp. Persisted via ref so it
  // survives re-renders without re-creating the dedupe state.
  const recentKeysRef = useRef<Map<string, number>>(new Map())

  const isDuplicate = useCallback((key: string) => {
    const now = Date.now()
    const map = recentKeysRef.current
    // Drop entries older than the dedupe window so the map doesn't grow.
    for (const [k, ts] of map) {
      if (now - ts > DEDUPE_WINDOW_MS) map.delete(k)
    }
    const last = map.get(key)
    if (last !== undefined && now - last < DEDUPE_WINDOW_MS) {
      return true
    }
    map.set(key, now)
    return false
  }, [])
  
  // Load from backend on mount
  useEffect(() => {
    const fetchNotifications = async () => {
      const { getAccessToken } = require('@/lib/auth-session')
      if (!getAccessToken()) {
        const saved = localStorage.getItem('hanjeli_notifications')
        if (saved) {
          try {
            setNotifications(JSON.parse(saved))
          } catch {}
        }
        return
      }
      try {
        const res = await apiClient.get('/notifications?limit=50') as NotificationsResponse | BackendNotification[]
        const rows = Array.isArray(res) ? res : res.data ?? []
        const formatted: AppNotification[] = rows.map((n) => ({
          id: n.id ?? `notif-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          title: n.title,
          description: n.description,
          type: n.type ?? 'info',
          category: n.category,
          read: n.read ?? false,
          date: n.created_at ?? new Date().toISOString(),
        }))
        setNotifications(formatted)
      } catch (e) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('Failed to fetch notifications from backend (fallback to local storage)', e)
        }
        const saved = localStorage.getItem('hanjeli_notifications')
        if (saved) {
          try {
            setNotifications(JSON.parse(saved))
          } catch {}
        }
      }
    }

    fetchNotifications()
  }, [])

  // Listen for real-time notifications via shared socket
  useEffect(() => {
    if (!socket) return

    const handleNewNotification = (notif: BackendNotification) => {
      const dedupeKey = `${notif.type ?? 'info'}|${notif.title}|${notif.description ?? ''}`
      if (isDuplicate(dedupeKey)) return

      setIsRinging(true)
      setTimeout(() => setIsRinging(false), 2000)

      const newNotif: AppNotification = {
        id: notif.id || Math.random().toString(36).substring(2, 9),
        title: notif.title,
        description: notif.description,
        type: notif.type || 'info',
        category: notif.category || 'general',
        read: false,
        date: notif.created_at || new Date().toISOString()
      }

      setNotifications(prev => [newNotif, ...prev].slice(0, 50))

      toast.custom(
        (t) => (
          <CustomToast
            toastId={t}
            type={newNotif.type}
            title={newNotif.title}
            description={newNotif.description}
            category={newNotif.category}
          />
        ),
        {
          duration: durationByType[newNotif.type] || 4000,
          position: 'top-center',
        }
      )
    }

    socket.on('notification:new', handleNewNotification)

    return () => {
      socket.off('notification:new', handleNewNotification)
    }
  }, [socket, isDuplicate])

  // Save local notifications fallback
  useEffect(() => {
    localStorage.setItem('hanjeli_notifications', JSON.stringify(notifications))
  }, [notifications])

  const addNotification = useCallback((notif: Omit<AppNotification, 'id' | 'date' | 'read'>) => {
    const dedupeKey = `${notif.type}|${notif.title}|${notif.description ?? ''}`
    if (isDuplicate(dedupeKey)) return

    const newNotif: AppNotification = {
      ...notif,
      id: Math.random().toString(36).substring(2, 9),
      date: new Date().toISOString(),
      read: false
    }

    setNotifications(prev => [newNotif, ...prev].slice(0, 50))

    // Trigger custom Sonner toast
    toast.custom(
      (t) => (
        <CustomToast
          toastId={t}
          type={notif.type}
          title={notif.title}
          description={notif.description}
          category={notif.category}
        />
      ),
      {
        duration: durationByType[notif.type] || 4000,
        position: 'top-center',
      }
    )
  }, [])

  const markAsRead = useCallback(async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    try {
      if (id.length > 20) await apiClient.patch(`/notifications/${id}/read`)
    } catch (e) {
      if (process.env.NODE_ENV !== 'production') console.warn(e)
    }
  }, [])

  const markAllAsRead = useCallback(async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    try {
      await apiClient.patch('/notifications/read-all')
    } catch (e) {
      if (process.env.NODE_ENV !== 'production') console.warn(e)
    }
  }, [])

  const clearAll = useCallback(async () => {
    setNotifications([])
    localStorage.removeItem('hanjeli_notifications')
    try {
      await apiClient.delete('/notifications')
    } catch (e) {
      if (process.env.NODE_ENV !== 'production') console.warn(e)
    }
  }, [])

  const removeNotification = useCallback(async (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
    try {
      if (id.length > 20) await apiClient.delete(`/notifications/${id}`)
    } catch (e) {
      if (process.env.NODE_ENV !== 'production') console.warn(e)
    }
  }, [])

  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, addNotification, markAsRead, markAllAsRead, clearAll, removeNotification, isRinging }}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider')
  }
  return context
}
