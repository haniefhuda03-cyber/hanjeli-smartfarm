/**
 * Single source of truth for route-level access policy.
 *
 * Pure module — no browser or Node APIs — so it can be imported from BOTH the
 * Next.js proxy (server, nodejs runtime) and client components (RouteGuard).
 * Keeping the classifier here guarantees the server-side gate and the
 * client-side gate can never drift out of sync.
 *
 * Route classes:
 *  - "public"    → reachable by anyone, any auth state (landing page, 404s).
 *  - "guest"     → ONLY reachable while logged OUT (all auth screens). An
 *                  authenticated visitor is bounced to the dashboard.
 *  - "protected" → ONLY reachable while logged IN (the dashboard). An
 *                  unauthenticated visitor is bounced to /login.
 *  - "callback"  → OAuth return endpoint; always allowed because it is the
 *                  mechanism that establishes the session.
 *  - "open"      → reachable in ANY auth state, but with a client-side
 *                  precondition (sessionStorage) enforced by RouteGuard.
 *                  Dipakai /reset-password: link reset dari email harus tetap
 *                  bekerja walau user SEDANG login (server tidak bisa melihat
 *                  sessionStorage, jadi proxy meloloskan dan guard yang
 *                  memeriksa token/intent).
 */
export type RouteClass = 'public' | 'guest' | 'protected' | 'callback' | 'open'

/** Dashboard / app area — requires an active session. */
export const PROTECTED_PREFIXES = [
  '/home',
  '/monitoring',
  '/irrigation',
  '/users',
  '/profile',
] as const

/** Auth screens — only for logged-out users. */
export const GUEST_PREFIXES = [
  '/login',
  '/register',
  '/forgot-password',
] as const

export const HOME_PATH = '/home'
export const LOGIN_PATH = '/login'

/* Sensitive guest sub-routes that need an in-app precondition (a challenge
   token or an explicit intent) which lives in sessionStorage and therefore
   cannot be seen by middleware. RouteGuard enforces these client-side. */
export const FORGOT_PASSWORD_PATH = '/forgot-password'
export const VERIFY_2FA_PATH = '/login/verify-2fa'
export const RECOVERY_PATH = '/login/recovery'
export const VERIFY_EMAIL_PATH = '/register/verify-email'
export const RESET_PASSWORD_PATH = '/reset-password'

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(prefix + '/')
}

export function classifyRoute(pathname: string): RouteClass {
  if (pathname === '/') return 'public'

  // OAuth callback must run regardless of current auth state.
  if (pathname === '/auth/callback' || matchesPrefix(pathname, '/auth')) {
    return 'callback'
  }

  // Reset password harus bisa dibuka dalam status login APA PUN — link dari
  // email tetap valid walau user sedang punya sesi aktif. Prasyarat token
  // reset ditegakkan client-side oleh RouteGuard.
  if (matchesPrefix(pathname, RESET_PASSWORD_PATH)) {
    return 'open'
  }

  if (PROTECTED_PREFIXES.some((p) => matchesPrefix(pathname, p))) {
    return 'protected'
  }

  if (GUEST_PREFIXES.some((p) => matchesPrefix(pathname, p))) {
    return 'guest'
  }

  return 'public'
}

/**
 * True for guest routes that additionally require a client-only precondition.
 * RouteGuard renders a loader (instead of the page) until the precondition is
 * confirmed, so a direct-URL visitor never even sees the form.
 */
export function requiresClientPrecondition(pathname: string): boolean {
  return (
    matchesPrefix(pathname, VERIFY_2FA_PATH) ||
    matchesPrefix(pathname, RECOVERY_PATH) ||
    pathname === FORGOT_PASSWORD_PATH ||
    matchesPrefix(pathname, VERIFY_EMAIL_PATH) ||
    matchesPrefix(pathname, RESET_PASSWORD_PATH)
  )
}
