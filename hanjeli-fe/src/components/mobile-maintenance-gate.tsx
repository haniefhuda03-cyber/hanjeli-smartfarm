"use client"

import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Monitor, Wrench, Construction } from "lucide-react"

/**
 * MobileMaintenanceGate
 * ---------------------
 * Renders a full-screen maintenance overlay when the viewport is below desktop
 * width (< 1024px). On desktop the children render normally.
 *
 * All existing page code is preserved — nothing is deleted.
 * This component simply hides children behind the overlay on small screens.
 */
export function MobileMaintenanceGate({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation()
  const [isMobile, setIsMobile] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)

    const check = () => setIsMobile(window.innerWidth < 1024)
    check()

    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  // Avoid hydration mismatch — render children on server, gate only on client
  if (!mounted) return <>{children}</>

  if (!isMobile) return <>{children}</>

  return (
    <div className="fixed inset-0 z-9999 flex items-center justify-center bg-page px-6">
      {/* Subtle animated background shapes */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-20 -left-20 h-64 w-64 rounded-full bg-leaf/10 blur-3xl animate-pulse" />
        <div className="absolute -bottom-32 -right-32 h-80 w-80 rounded-full bg-primary/10 blur-3xl animate-pulse [animation-delay:1s]" />
      </div>

      <div className="relative max-w-md w-full rounded-3xl bg-surface-sage p-8 sm:p-10 text-center border border-white/70 neu-raised-lg">
        {/* Animated icon cluster */}
        <div className="mx-auto mb-6 flex items-center justify-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 neu-inset animate-bounce [animation-delay:0.2s]">
            <Construction className="h-7 w-7" />
          </div>
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary neu-inset">
            <Wrench className="h-8 w-8 animate-spin animation-duration-[3s]" />
          </div>
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 neu-inset animate-bounce [animation-delay:0.5s]">
            <Construction className="h-7 w-7" />
          </div>
        </div>

        {/* Title */}
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-primary mb-2">
          {t("maintenance.title", "Dalam Pemeliharaan")}
        </h1>

        {/* Description */}
        <p className="text-sm sm:text-base text-foreground/60 leading-relaxed mb-6">
          {t(
            "maintenance.description",
            "Tampilan mobile dan tablet sedang dalam tahap pengembangan. Silakan akses melalui perangkat desktop untuk pengalaman terbaik."
          )}
        </p>

        {/* Desktop hint */}
        <div className="inline-flex items-center gap-2.5 rounded-2xl bg-surface-sage-soft px-5 py-3 text-sm font-semibold text-primary border border-primary/10 neu-raised-sm">
          <Monitor className="h-5 w-5" />
          {t("maintenance.hint", "Buka di Desktop")}
        </div>

        {/* Progress bar animation */}
        <div className="mt-6 mx-auto max-w-[200px]">
          <div className="h-1.5 w-full rounded-full bg-primary/10 overflow-hidden">
            <div className="h-full w-1/2 rounded-full bg-linear-to-r from-primary to-leaf animate-[shimmer_2s_ease-in-out_infinite]" />
          </div>
          <p className="mt-2 text-[11px] text-foreground/40 font-medium tracking-wide uppercase">
            {t("maintenance.progress", "Sedang Dikembangkan")}
          </p>
        </div>
      </div>
    </div>
  )
}
