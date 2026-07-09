"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import {
  classifyRoute,
  requiresClientPrecondition,
  FORGOT_PASSWORD_PATH,
  VERIFY_2FA_PATH,
  VERIFY_EMAIL_PATH,
  RECOVERY_PATH,
  HOME_PATH,
  LOGIN_PATH,
} from "@/lib/auth-routes"
import {
  clearAuthSession,
  getChallengeToken,
  getLastActivity,
  getResetPasswordToken,
  hasForgotPasswordIntent,
  hasResetPasswordIntent,
  hasValidSession,
  hasVerifyEmailIntent,
  isIdleExpired,
  markActivity,
  syncSessionCookie,
} from "@/lib/auth-session"
import { AuthLoadingFallback } from "@/lib/auth-shared"

/**
 * Client-side companion to the server `proxy` gate.
 *
 * The proxy enforces the coarse public/guest/protected rules before render.
 * RouteGuard adds the parts the proxy cannot do because they depend on
 * client-only state, and reacts to session changes that happen WITHOUT a
 * navigation:
 *
 *  - Bug #1/#2 — proactively detects an expired (absolute) or idle session and
 *    force-logs-out + redirects to /login the instant it happens, even if the
 *    user is just sitting on a page making no requests.
 *  - Bug #3/#4 — backup enforcement of guest/protected redirects (covers the
 *    moment auth state flips in another tab).
 *  - Bug #5 — gates /forgot-password (requires the "Lupa kata sandi" intent),
 *    /login/verify-2fa and /login/recovery (require a 2FA challenge token).
 *    These sensitive screens render a loader — never the form — until the
 *    precondition is confirmed, so a direct-URL visitor sees nothing.
 */

const MONITOR_INTERVAL_MS = 15_000
const ACTIVITY_THROTTLE_MS = 5_000
const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "scroll",
  "touchstart",
  "pointerdown",
  "click",
] as const

type Decision = { allow: true } | { allow: false; redirect: string; clear: boolean }

function urlHasChallengeToken(): boolean {
  if (typeof window === "undefined") return false
  return Boolean(new URLSearchParams(window.location.search).get("challenge_token"))
}

/**
 * Pure client-side decision for the current path. Mirrors the proxy rules and
 * layers the sessionStorage-based preconditions on top.
 */
function urlHasResetToken(): boolean {
  if (typeof window === "undefined") return false
  return Boolean(new URLSearchParams(window.location.search).get("token"))
}

function decide(pathname: string): Decision {
  const routeClass = classifyRoute(pathname)

  if (routeClass === "callback" || routeClass === "public") {
    return { allow: true }
  }

  const authed = hasValidSession()

  // "open" — /reset-password: boleh dibuka dalam status login apa pun,
  // ASAL datang dari link email (token di sessionStorage via /auth/callback,
  // atau ?token= pada tautan lama). Tanpa token → arahkan sesuai status.
  if (routeClass === "open") {
    const hasResetContext =
      Boolean(getResetPasswordToken()) ||
      hasResetPasswordIntent() ||
      urlHasResetToken()
    if (hasResetContext) return { allow: true }
    return {
      allow: false,
      redirect: authed ? HOME_PATH : LOGIN_PATH,
      clear: false,
    }
  }

  if (routeClass === "protected") {
    if (!authed) return { allow: false, redirect: LOGIN_PATH, clear: true }
    return { allow: true }
  }

  // routeClass === "guest"
  if (authed) {
    return { allow: false, redirect: HOME_PATH, clear: false }
  }

  // Logged-out + guest route: apply the bug #5 preconditions.
  if (pathname.startsWith(VERIFY_2FA_PATH) || pathname.startsWith(RECOVERY_PATH)) {
    const hasChallenge = Boolean(getChallengeToken()) || urlHasChallengeToken()
    if (!hasChallenge) return { allow: false, redirect: LOGIN_PATH, clear: false }
  }

  if (pathname === FORGOT_PASSWORD_PATH) {
    if (!hasForgotPasswordIntent()) {
      return { allow: false, redirect: LOGIN_PATH, clear: false }
    }
  }

  // Gate /register/verify-email — only reachable after a successful registration.
  if (pathname.startsWith(VERIFY_EMAIL_PATH)) {
    if (!hasVerifyEmailIntent()) {
      return { allow: false, redirect: '/register', clear: false }
    }
  }

  return { allow: true }
}

export function RouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  // Sensitive screens must not flash their form: they stay hidden behind a
  // loader until the client confirms the precondition for THIS exact path.
  // We track the last path proven allowed; a sensitive path that has not yet
  // been proven renders the loader. Non-sensitive paths are allowed on sight.
  // Server and first client render agree (sensitive ⇒ not-yet-allowed ⇒ loader),
  // so there is no hydration mismatch.
  const [allowedPath, setAllowedPath] = useState<string | null>(
    requiresClientPrecondition(pathname) ? null : pathname,
  )

  // ── Route decision (runs on every navigation) ──
  useEffect(() => {
    syncSessionCookie()
    const decision = decide(pathname)

    if (!decision.allow) {
      if (decision.clear) clearAuthSession()
      // Leave allowedPath unchanged: for a sensitive route it is still ≠ pathname,
      // so the loader keeps covering the page while we redirect (no form flash).
      router.replace(decision.redirect)
      return
    }

    // Reveal the page only after the client confirms it is allowed for THIS path.
    // This is a deliberate post-hydration sync with client-only storage, which
    // unavoidably transitions state inside an effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAllowedPath(pathname)
  }, [pathname, router])

  const showLoader =
    requiresClientPrecondition(pathname) && allowedPath !== pathname

  // ── Live session monitor (mounts once) ──
  const lastActivityWrite = useRef(0)
  const isLoggingOutRef = useRef(false)
  useEffect(() => {
    const onActivity = () => {
      const now = Date.now()
      if (now - lastActivityWrite.current < ACTIVITY_THROTTLE_MS) return
      lastActivityWrite.current = now
      markActivity()
    }

    ACTIVITY_EVENTS.forEach((evt) =>
      window.addEventListener(evt, onActivity, { passive: true }),
    )

    const forceLogout = (reason: string) => {
      if (isLoggingOutRef.current) return
      isLoggingOutRef.current = true
      clearAuthSession()
      const current = window.location.pathname
      if (classifyRoute(current) === "protected") {
        router.replace(`${LOGIN_PATH}?reason=${reason}`)
      }
      setTimeout(() => { isLoggingOutRef.current = false }, 2000)
    }

    const tick = () => {
      const currentPath = window.location.pathname

      if (hasValidSession()) {
        // Bug #1 — inactivity auto-logout for long-lived sessions.
        if (isIdleExpired()) {
          forceLogout("idle")
          return
        }
        // Bug #3 — session became valid (e.g. logged in elsewhere) while on an
        // auth screen; bounce to the dashboard.
        if (classifyRoute(currentPath) === "guest") {
          router.replace(HOME_PATH)
        }
        return
      }

      // No valid session. Bug #2/#4 — if sitting on a protected page, eject now.
      if (classifyRoute(currentPath) === "protected") {
        forceLogout("expired")
      }
    }

    const interval = window.setInterval(tick, MONITOR_INTERVAL_MS)
    const onFocus = () => tick()
    const onVisibility = () => {
      if (document.visibilityState === "visible") tick()
    }
    const onAuthChanged = () => tick()

    window.addEventListener("focus", onFocus)
    document.addEventListener("visibilitychange", onVisibility)
    window.addEventListener("hanjeli:auth-changed", onAuthChanged)
    // Cross-tab: localStorage mutations (login/logout in another tab) fire here.
    window.addEventListener("storage", onAuthChanged)

    // Establish a baseline activity timestamp if none exists yet.
    if (hasValidSession() && getLastActivity() === null) markActivity()

    return () => {
      ACTIVITY_EVENTS.forEach((evt) =>
        window.removeEventListener(evt, onActivity),
      )
      window.clearInterval(interval)
      window.removeEventListener("focus", onFocus)
      document.removeEventListener("visibilitychange", onVisibility)
      window.removeEventListener("hanjeli:auth-changed", onAuthChanged)
      window.removeEventListener("storage", onAuthChanged)
    }
  }, [router])

  if (showLoader) {
    return <AuthLoadingFallback />
  }

  return <>{children}</>
}
