"use client"

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"
import { io, type Socket } from "socket.io-client"
import { getSocketUrl } from "@/lib/runtime-config"
import { getAccessToken } from "@/lib/auth-session"

type SocketContextValue = {
  socket: Socket | null
  isConnected: boolean
}

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  isConnected: false,
})

export function SocketProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    let instance: Socket | null = null

    const teardown = () => {
      if (instance) {
        instance.disconnect()
        instance = null
      }
      setSocket(null)
      setIsConnected(false)
    }

    const connect = () => {
      const token = getAccessToken()
      if (!token) return

      instance = io(getSocketUrl(), {
        transports: ["websocket"],
        auth: { token },
      })

      instance.on("connect", () => setIsConnected(true))
      instance.on("disconnect", () => setIsConnected(false))

      setSocket(instance)
    }

    // Reconnect dengan token terbaru setiap status auth berubah
    // (login/logout/refresh) — tanpa ini, login baru tidak pernah
    // mendapat data realtime sampai halaman di-reload penuh.
    const reconnect = () => {
      teardown()
      connect()
    }

    connect()
    window.addEventListener("hanjeli:auth-changed", reconnect)
    window.addEventListener("storage", reconnect)

    return () => {
      window.removeEventListener("hanjeli:auth-changed", reconnect)
      window.removeEventListener("storage", reconnect)
      teardown()
    }
  }, [])

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  )
}

export function useSocket(): SocketContextValue {
  return useContext(SocketContext)
}
