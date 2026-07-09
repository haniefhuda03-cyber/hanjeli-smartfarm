"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"

/**
 * Renders its children into document.body via a portal.
 *
 * Why this exists: the dashboard <main> uses `backdrop-filter`, which creates a
 * containing block for `position: fixed` descendants — so modals rendered inside
 * it get trapped/clipped within the scroll area instead of covering the viewport.
 * Portaling to <body> escapes that containing block so overlays center correctly.
 */
export function ModalPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  if (!mounted || typeof document === "undefined") return null
  return createPortal(children, document.body)
}
