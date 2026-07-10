export type AuthUser = {
  id: string
  email: string
  name?: string
  role?: string
  avatar_url?: string | null
}

export type AuthTokensResponse = {
  access_token: string
  refresh_token: string
  token_type?: "Bearer"
  expires_in?: number
  user?: AuthUser
}

const ACCESS_TOKEN_KEY = "access_token"
const REFRESH_TOKEN_KEY = "refresh_token"
const TOKEN_EXPIRES_AT_KEY = "token_expires_at"
const SESSION_EXPIRES_AT_KEY = "session_expires_at"
const SESSION_STARTED_AT_KEY = "session_started_at"
const LAST_ACTIVITY_KEY = "last_activity_at"
const USER_KEY = "user"
const CHALLENGE_TOKEN_KEY = "challenge_token"
const FORGOT_INTENT_KEY = "forgot_password_intent"
const VERIFY_EMAIL_INTENT_KEY = "verify_email_intent"
const RESET_PASSWORD_INTENT_KEY = "reset_password_intent"
const RESET_PASSWORD_TOKEN_KEY = "reset_password_token"

/**
 * Non-sensitive cookie marker mirroring the effective session-expiry (ms epoch).
 * It is NOT a credential — it only lets the Next.js proxy/middleware perform
 * server-side route gating (which cannot read localStorage). All real
 * authorization is still enforced by the backend JWT guard on every request.
 */
const SESSION_COOKIE = "hanjeli_session"

/**
 * Session-lifetime policy (tune here). Two independent caps, whichever hits
 * first ends the session:
 *  - IDLE_TIMEOUT_MS  — no user interaction for this long ⇒ auto-logout.
 *  - ABSOLUTE_SESSION_MAX_MS — hard ceiling measured from first login; NOT
 *    extended by token refresh, so an actively-kept-open session still ends
 *    (bounds the blast radius of a hijacked active session).
 * The effective expiry is min(refresh-token exp, login + absolute cap).
 */
export const IDLE_TIMEOUT_MS = 30 * 60 * 1000 // 30 minutes of inactivity
export const ABSOLUTE_SESSION_MAX_MS = 12 * 60 * 60 * 1000 // 12 hours since login
const DEFAULT_REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000 // fallback if decode fails

function canUseBrowserStorage() {
  return typeof window !== "undefined"
}

/** Decode a JWT's `exp` (seconds) into an absolute ms timestamp. Read-only — no
 *  signature verification (the backend is the authority); used purely for UX
 *  timing of the absolute session cap. */
function decodeJwtExpMs(token: string): number | null {
  try {
    const part = token.split(".")[1]
    if (!part) return null
    const base64 = part.replace(/-/g, "+").replace(/_/g, "/")
    const json = atob(base64)
    const payload = JSON.parse(json) as { exp?: number }
    return typeof payload.exp === "number" ? payload.exp * 1000 : null
  } catch {
    return null
  }
}

function writeSessionCookie(expiresAtMs: number) {
  if (!canUseBrowserStorage()) return
  const maxAgeSec = Math.max(0, Math.floor((expiresAtMs - Date.now()) / 1000))
  const secure = window.location.protocol === "https:" ? "; secure" : ""
  document.cookie = `${SESSION_COOKIE}=${expiresAtMs}; path=/; max-age=${maxAgeSec}; samesite=lax${secure}`
}

function deleteSessionCookie() {
  if (!canUseBrowserStorage()) return
  document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0; samesite=lax`
}

export function getAccessToken() {
  if (!canUseBrowserStorage()) return null
  return localStorage.getItem(ACCESS_TOKEN_KEY)
}

export function getRefreshToken() {
  if (!canUseBrowserStorage()) return null
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

export function storeAuthSession(
  session: AuthTokensResponse,
  options?: { isRefresh?: boolean },
) {
  if (!canUseBrowserStorage()) return

  localStorage.setItem(ACCESS_TOKEN_KEY, session.access_token)
  localStorage.setItem(REFRESH_TOKEN_KEY, session.refresh_token)

  if (session.expires_in) {
    localStorage.setItem(
      TOKEN_EXPIRES_AT_KEY,
      String(Date.now() + session.expires_in * 1000),
    )
  }

  // Anchor session start once per login. Token refresh re-enters this function
  // with a fresh refresh token, but we keep the ORIGINAL start so the absolute
  // cap is not slid forward — the session still ends 12h after first login.
  const now = Date.now()
  let startedAt = now

  if (options?.isRefresh) {
    const existingStart = Number(localStorage.getItem(SESSION_STARTED_AT_KEY))
    if (Number.isFinite(existingStart) && existingStart > 0) {
      startedAt = existingStart
    }
  }

  localStorage.setItem(SESSION_STARTED_AT_KEY, String(startedAt))

  // Effective expiry = whichever cap is sooner.
  const refreshExpiresAt =
    decodeJwtExpMs(session.refresh_token) ?? now + DEFAULT_REFRESH_TTL_MS
  const absoluteCapEnd = startedAt + ABSOLUTE_SESSION_MAX_MS
  const sessionExpiresAt = Math.min(refreshExpiresAt, absoluteCapEnd)

  localStorage.setItem(SESSION_EXPIRES_AT_KEY, String(sessionExpiresAt))
  writeSessionCookie(sessionExpiresAt)

  // A freshly established session starts "active now" for idle tracking.
  localStorage.setItem(LAST_ACTIVITY_KEY, String(now))

  if (session.user) {
    localStorage.setItem(USER_KEY, JSON.stringify(session.user))
  }

  window.dispatchEvent(new Event("hanjeli:auth-changed"))
}

export function storeCurrentUser(user: AuthUser) {
  if (!canUseBrowserStorage()) return
  localStorage.setItem(USER_KEY, JSON.stringify(user))
  window.dispatchEvent(new Event("hanjeli:auth-changed"))
}

export function getStoredUser(): AuthUser | null {
  if (!canUseBrowserStorage()) return null
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as AuthUser
  } catch {
    return null
  }
}

export function clearAuthSession() {
  if (!canUseBrowserStorage()) return
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
  localStorage.removeItem(TOKEN_EXPIRES_AT_KEY)
  localStorage.removeItem(SESSION_EXPIRES_AT_KEY)
  localStorage.removeItem(SESSION_STARTED_AT_KEY)
  localStorage.removeItem(LAST_ACTIVITY_KEY)
  localStorage.removeItem(USER_KEY)
  sessionStorage.removeItem(CHALLENGE_TOKEN_KEY)
  sessionStorage.removeItem(FORGOT_INTENT_KEY)
  sessionStorage.removeItem(VERIFY_EMAIL_INTENT_KEY)
  /* Intent + token reset-password SENGAJA dipertahankan: alur reset milik
     user yang (biasanya) sedang logout — force-logout (idle/expired) di
     tengah alur tidak boleh menghanguskan tautan reset dari email. */
  deleteSessionCookie()
  window.dispatchEvent(new Event("hanjeli:auth-changed"))
}

/** Effective session expiry (ms epoch) = min(refresh-token exp, login + absolute cap). */
export function getSessionExpiresAt(): number | null {
  if (!canUseBrowserStorage()) return null
  const raw = localStorage.getItem(SESSION_EXPIRES_AT_KEY)
  if (!raw) return null
  const value = Number(raw)
  return Number.isFinite(value) ? value : null
}

/**
 * True when a usable session exists: both tokens present AND the absolute
 * lifetime has not elapsed. Idle timeout is evaluated separately by RouteGuard.
 */
export function hasValidSession(): boolean {
  if (!canUseBrowserStorage()) return false
  if (!getAccessToken() || !getRefreshToken()) return false
  const expiresAt = getSessionExpiresAt()
  if (expiresAt !== null && Date.now() >= expiresAt) return false
  return true
}

/**
 * Re-derive the cookie marker from localStorage when it is missing but a valid
 * session exists (e.g. first load after this feature shipped, or a cookie that
 * was cleared independently). Keeps middleware and client state consistent.
 */
export function syncSessionCookie(): void {
  if (!canUseBrowserStorage()) return
  if (!hasValidSession()) {
    deleteSessionCookie()
    return
  }
  const expiresAt = getSessionExpiresAt()
  if (expiresAt === null) return
  const cookiePresent = document.cookie
    .split(";")
    .some((c) => c.trim().startsWith(`${SESSION_COOKIE}=`))
  if (!cookiePresent) writeSessionCookie(expiresAt)
}

/* ── Idle-activity tracking (drives the inactivity auto-logout) ── */
export function markActivity(): void {
  if (!canUseBrowserStorage()) return
  localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()))
}

export function getLastActivity(): number | null {
  if (!canUseBrowserStorage()) return null
  const raw = localStorage.getItem(LAST_ACTIVITY_KEY)
  if (!raw) return null
  const value = Number(raw)
  return Number.isFinite(value) ? value : null
}

export function isIdleExpired(): boolean {
  const last = getLastActivity()
  if (last === null) return false
  return Date.now() - last > IDLE_TIMEOUT_MS
}

/* ── Forgot-password intent (B5): the page is reachable only after the user
   clicks "Lupa kata sandi" on /login, never by typing the URL directly. ── */
export function markForgotPasswordIntent(): void {
  if (!canUseBrowserStorage()) return
  sessionStorage.setItem(FORGOT_INTENT_KEY, "1")
}

export function hasForgotPasswordIntent(): boolean {
  if (!canUseBrowserStorage()) return false
  return sessionStorage.getItem(FORGOT_INTENT_KEY) === "1"
}

export function clearForgotPasswordIntent(): void {
  if (!canUseBrowserStorage()) return
  sessionStorage.removeItem(FORGOT_INTENT_KEY)
}

export function storeChallengeToken(token: string) {
  if (!canUseBrowserStorage()) return
  sessionStorage.setItem(CHALLENGE_TOKEN_KEY, token)
}

export function getChallengeToken() {
  if (!canUseBrowserStorage()) return null
  return sessionStorage.getItem(CHALLENGE_TOKEN_KEY)
}

export function clearChallengeToken() {
  if (!canUseBrowserStorage()) return
  sessionStorage.removeItem(CHALLENGE_TOKEN_KEY)
}

/* ── Verify-email intent: the /register/verify-email page is reachable only
   after a successful registration call, never by typing the URL directly. ── */
export function markVerifyEmailIntent(email: string): void {
  if (!canUseBrowserStorage()) return
  sessionStorage.setItem(VERIFY_EMAIL_INTENT_KEY, email)
}

export function getVerifyEmailIntent(): string | null {
  if (!canUseBrowserStorage()) return null
  return sessionStorage.getItem(VERIFY_EMAIL_INTENT_KEY)
}

export function hasVerifyEmailIntent(): boolean {
  if (!canUseBrowserStorage()) return false
  return Boolean(sessionStorage.getItem(VERIFY_EMAIL_INTENT_KEY))
}

export function clearVerifyEmailIntent(): void {
  if (!canUseBrowserStorage()) return
  sessionStorage.removeItem(VERIFY_EMAIL_INTENT_KEY)
}

/* ── Reset-password intent: the /reset-password page is reachable only after
   clicking the reset link from the email (processed through /auth/callback),
   never by typing the URL directly. ── */
export function markResetPasswordIntent(): void {
  if (!canUseBrowserStorage()) return
  sessionStorage.setItem(RESET_PASSWORD_INTENT_KEY, "1")
}

export function hasResetPasswordIntent(): boolean {
  if (!canUseBrowserStorage()) return false
  return sessionStorage.getItem(RESET_PASSWORD_INTENT_KEY) === "1"
}

export function clearResetPasswordIntent(): void {
  if (!canUseBrowserStorage()) return
  sessionStorage.removeItem(RESET_PASSWORD_INTENT_KEY)
}

/* ── Reset-password token: dibawa lewat sessionStorage, BUKAN query string,
   agar token kritis tidak pernah tampil di address bar / riwayat browser. ── */
export function storeResetPasswordToken(token: string): void {
  if (!canUseBrowserStorage()) return
  sessionStorage.setItem(RESET_PASSWORD_TOKEN_KEY, token)
}

export function getResetPasswordToken(): string | null {
  if (!canUseBrowserStorage()) return null
  return sessionStorage.getItem(RESET_PASSWORD_TOKEN_KEY)
}

export function clearResetPasswordToken(): void {
  if (!canUseBrowserStorage()) return
  sessionStorage.removeItem(RESET_PASSWORD_TOKEN_KEY)
}
