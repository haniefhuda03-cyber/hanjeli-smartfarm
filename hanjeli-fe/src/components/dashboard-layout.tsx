"use client"

import { usePathname, useRouter } from "next/navigation"
import { useState, useRef, useEffect, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import Link from "next/link"
import {
  Home,
  BarChart3,
  Droplet,
  User,
  Users,
  LogOut,
  Leaf,
  BrainCircuit,
} from "lucide-react"
import Image from "next/image"

const ChatbotIcon = ({ className }: { className?: string }) => (
  <div 
    className={cn("bg-current inline-block shrink-0", className)} 
    style={{ 
      maskImage: 'url(/chatbot.png)', 
      WebkitMaskImage: 'url(/chatbot.png)', 
      maskSize: 'contain', 
      WebkitMaskSize: 'contain', 
      maskRepeat: 'no-repeat', 
      WebkitMaskRepeat: 'no-repeat',
      maskPosition: 'center',
      WebkitMaskPosition: 'center',
      filter: 'drop-shadow(0px 0px 0.5px currentColor) drop-shadow(0px 0px 1px currentColor)'
    }} 
  />
)
import { cn } from "@/lib/utils"
import { useCurrentUser } from "@/lib/hooks/useCurrentUser"
import { authApi } from "@/lib/api/auth"
import { getAccessToken } from "@/lib/auth-session"

const VIDEO_SRC = "/Video%20Looping.mp4"

const navItems = [
  { id: "home", labelKey: "nav.home", href: "/home", icon: Home },
  { id: "monitoring", labelKey: "nav.monitoring", href: "/monitoring", icon: BarChart3 },
  { id: "ai-analysis", labelKey: "nav.ai_analysis", href: "/ai-analysis", icon: BrainCircuit },
  { id: "ai-chatbot", labelKey: "nav.ai_chatbot", href: "/ai-chatbot", icon: ChatbotIcon },
  { id: "irrigation", labelKey: "nav.irrigation", href: "/irrigation", icon: Droplet },
  { id: "users", labelKey: "nav.users", href: "/users", icon: Users, fallbackLabel: "Akun Pengguna" },
  { id: "profile", labelKey: "nav.profile", href: "/profile", icon: User },
]

const dashboardRoutes = ["/home", "/monitoring", "/ai-analysis", "/ai-chatbot", "/irrigation", "/users", "/profile"]

/* ─── Shared glassmorphism values ─── */
const glassStyle = {
  background: 'rgba(250, 249, 244, 0.42)',
  backdropFilter: 'blur(24px) saturate(180%)',
  WebkitBackdropFilter: 'blur(24px) saturate(180%)',
  border: '1px solid rgba(255, 255, 255, 0.45)',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.06), inset 0 1px 0 rgba(255,255,255,0.5)',
} as const

/**
 * Lightweight wrapper — checks the path BEFORE mounting any heavy hooks.
 * Non-dashboard pages (login, verify-2fa, recovery, register, landing)
 * get children directly, without useCurrentUser / video / sidebar ever
 * mounting. This prevents 401 API calls and video-404 spam on guest pages.
 */
export function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const isDashboard = dashboardRoutes.some(r => pathname === r || pathname.startsWith(r + "/"))

  if (!isDashboard) {
    return <>{children}</>
  }

  return <DashboardShell>{children}</DashboardShell>
}

/** Heavy shell — only mounted on actual dashboard routes. */
function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { t } = useTranslation()

  const { user, isAdmin } = useCurrentUser()
  // Hide admin-only tabs (Akun Pengguna, Irigasi) from non-admin / Guest accounts.
  const adminOnlyIds = new Set(["users", "irrigation"])
  const visibleNavItems = navItems.filter((item) => !adminOnlyIds.has(item.id) || isAdmin)

  // Client-side access control for dashboard routes: require a session, and keep
  // non-admins out of admin-only routes (the backend also enforces @Roles('Admin')).
  useEffect(() => {
    if (!getAccessToken()) {
      router.replace("/login")
      return
    }
    if (user && !isAdmin) {
      const blocked = ["/users", "/irrigation"]
      if (blocked.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
        router.replace("/home")
      }
    }
  }, [pathname, user, isAdmin, router])

  const handleLogout = () => {
    void authApi.logout()
  }

  const [isPinned, setIsPinned] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const sidebarRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [videoReady, setVideoReady] = useState(false)

  const isExpanded = isPinned || isHovered

  // Close sidebar when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (isPinned && sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
        setIsPinned(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isPinned])

  // Auto-play video
  useEffect(() => {
    const el = videoRef.current
    if (!el) return
    const play = () => { el.play().catch(() => {}) }
    if (el.readyState >= 2) play()
    else el.addEventListener("loadeddata", play, { once: true })
    return () => el.removeEventListener("loadeddata", play)
  }, [])

  return (
    <div className="dashboard-glass-root">
      {/* ═══ VIDEO BACKGROUND — Full viewport looping ═══ */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        {/* Poster / fallback */}
        <div
          className={cn(
            "absolute inset-0 transition-opacity duration-1000",
            videoReady ? "opacity-0" : "opacity-100"
          )}
          style={{ background: 'linear-gradient(135deg, #2d4a3e 0%, #1a3a2a 40%, #0d2818 100%)' }}
        />
        {/* Video */}
        <video
          ref={videoRef}
          src={VIDEO_SRC}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden="true"
          onCanPlay={() => setVideoReady(true)}
          className={cn(
            "absolute inset-0 h-full w-full object-cover transition-opacity duration-1000",
            videoReady ? "opacity-100" : "opacity-0"
          )}
        />
        {/* Subtle dark overlay to ensure glass contrast */}
        <div className="absolute inset-0 bg-black/15" />
      </div>

      {/* ═══ DESKTOP LAYOUT (lg+): Separate floating glass cards ═══ */}
      <div className="hidden lg:flex fixed inset-0 p-5 gap-4 z-0">

        {/* ─── SIDEBAR Glass Card ─── */}
        <aside
          ref={sidebarRef}
          className="flex flex-col shrink-0 transition-all duration-300 ease-in-out overflow-hidden"
          style={{
            width: isExpanded ? 220 : 66,
            borderRadius: '1.5rem',
            ...glassStyle,
          }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* Top — Logo + Brand */}
          <div className="flex items-center h-16 px-3 shrink-0 overflow-hidden">
            <button
              onClick={() => setIsPinned(!isPinned)}
              className="relative h-10 w-10 shrink-0 rounded-full overflow-hidden transition-all"
              style={{
                boxShadow: isPinned
                  ? 'inset 2px 2px 6px rgba(0,0,0,0.3), inset -2px -2px 6px rgba(255,255,255,0.5)'
                  : '2px 2px 6px rgba(0,0,0,0.12), -2px -2px 6px rgba(255,255,255,0.4)',
                transform: isPinned ? 'scale(0.95)' : 'scale(1)'
              }}
              aria-label="Toggle sidebar"
            >
              <Image
                src="/favicon.png"
                alt="Hanjeli"
                width={40}
                height={40}
                className="h-full w-full object-cover transition-opacity duration-300"
                style={{ opacity: isPinned ? 0.85 : 1 }}
              />
              <div
                className="absolute inset-0 rounded-full pointer-events-none transition-all duration-300"
                style={{
                  boxShadow: isPinned
                    ? 'inset 3px 3px 8px rgba(0,0,0,0.3), inset -3px -3px 8px rgba(255,255,255,0.5)'
                    : 'inset 0px 0px 0px rgba(0,0,0,0)',
                  background: isPinned ? 'rgba(0,0,0,0.05)' : 'transparent'
                }}
              />
            </button>
            <div
              className={cn(
                "flex items-center gap-2 ml-3 overflow-hidden transition-all duration-300",
                isExpanded ? "opacity-100 max-w-[140px]" : "opacity-0 max-w-0"
              )}
            >
              <span className="text-lg font-bold text-primary whitespace-nowrap drop-shadow-sm">Hanjeli</span>
            </div>
          </div>

          {/* Nav Items */}
          <nav className="flex-1 flex flex-col gap-1 px-2 pt-2 overflow-y-auto overflow-x-hidden" aria-label={t('nav.mainNavigation', 'Navigasi utama')}>
            {visibleNavItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
              const label = t(item.labelKey)
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  title={label}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200 group relative",
                    isActive ? "text-white" : "active:scale-[0.97]"
                  )}
                  style={
                    isActive
                      ? {
                          background: 'linear-gradient(135deg, var(--primary) 0%, #00875c 100%)',
                          boxShadow: '0 2px 12px rgba(0,108,73,0.35), inset 0 1px 0 rgba(255,255,255,0.15)'
                        }
                      : undefined
                  }
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'rgba(0, 108, 73, 0.12)'
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,108,73,0.1)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'transparent'
                      e.currentTarget.style.boxShadow = 'none'
                    }
                  }}
                >
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center">
                    <item.icon
                      className={cn(
                        "h-5 w-5 transition-colors",
                        isActive ? "text-white" : "text-foreground/60 group-hover:text-primary"
                      )}
                    />
                  </div>
                  <span
                    className={cn(
                      "text-sm font-medium whitespace-nowrap transition-all duration-300 overflow-hidden",
                      isActive ? "text-white" : "text-foreground/80 group-hover:text-foreground",
                      isExpanded ? "opacity-100 max-w-[140px]" : "opacity-0 max-w-0"
                    )}
                  >
                    {label}
                  </span>
                </Link>
              )
            })}
          </nav>

          {/* Bottom — Logout + Version */}
          <div className="px-2 py-3 shrink-0 overflow-hidden space-y-1">
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-3 w-full rounded-xl py-2.5 transition-all active:scale-[0.98] group"
              title={t('profile.logOut', 'Keluar')}
              aria-label={t('profile.logOut', 'Keluar')}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(186, 26, 26, 0.1)'
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(186,26,26,0.1)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              <div className="flex h-6 w-6 shrink-0 items-center justify-center">
                <LogOut className="h-5 w-5 text-destructive group-hover:text-destructive" />
              </div>
              <span
                className={cn(
                  "text-sm font-medium text-destructive whitespace-nowrap transition-all duration-300 overflow-hidden",
                  isExpanded ? "opacity-100 max-w-[140px]" : "opacity-0 max-w-0"
                )}
              >
                {t('profile.logOut', 'Keluar')}
              </span>
            </button>

            {/* Version info */}
            <div className="flex items-center gap-3 px-3 py-1">
              <div
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-leaf/20 text-primary-deepest"
                style={{
                  boxShadow: 'inset 1px 1px 3px rgba(0,0,0,0.1), inset -1px -1px 3px rgba(255,255,255,0.5)'
                }}
              >
                <Leaf className="h-4 w-4" />
              </div>
              <div
                className={cn(
                  "overflow-hidden transition-all duration-300",
                  isExpanded ? "opacity-100 max-w-[140px]" : "opacity-0 max-w-0"
                )}
              >
                <p className="text-[11px] font-semibold text-primary whitespace-nowrap">Smart Farm</p>
                <p className="text-[9px] text-foreground/50 whitespace-nowrap">v1.0.0</p>
              </div>
            </div>
          </div>
        </aside>

        {/* ─── CONTENT Glass Card ─── */}
        <main
          className="flex-1 overflow-y-auto overflow-x-hidden"
          style={{
            borderRadius: '1.5rem',
            ...glassStyle,
          }}
        >
          {children}
        </main>
      </div>

      {/* ═══ MOBILE/TABLET LAYOUT ═══ */}
      <div className="lg:hidden">
        {/* Video bg tint for mobile readability */}
        <div className="fixed inset-0 z-1 pointer-events-none bg-(--surface)/80 backdrop-blur-sm" />

        <main className="relative z-2 min-h-screen">
          {children}
        </main>

        {/* Mobile Bottom Nav — glass pill */}
        <div className="fixed left-1/2 z-50 -translate-x-1/2" style={{ bottom: 'max(24px, calc(env(safe-area-inset-bottom, 0px) + 12px))' }}>
          <div
            className="flex items-center gap-1 rounded-full px-3 py-2 shadow-lg shadow-black/10"
            role="navigation"
            aria-label={t('nav.mainNavigation', 'Navigasi utama')}
            style={{
              background: 'rgba(250,249,244,0.65)',
              backdropFilter: 'saturate(180%) blur(24px)',
              WebkitBackdropFilter: 'saturate(180%) blur(24px)',
              border: '1px solid rgba(255,255,255,0.4)',
            }}
          >
            {visibleNavItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
              const label = t(item.labelKey)
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  aria-label={label}
                  className={cn(
                    "flex flex-col items-center gap-0.5 rounded-full px-4 py-2 transition-all",
                    isActive ? "bg-primary" : "hover:bg-primary/5"
                  )}
                >
                  <item.icon className={cn(
                    "h-5 w-5",
                    isActive ? "text-white" : "text-foreground/50"
                  )} />
                  <span className={cn(
                    "text-[10px] font-medium",
                    isActive ? "text-white" : "text-foreground/50"
                  )}>{label}</span>
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
