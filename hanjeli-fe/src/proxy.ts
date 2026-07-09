import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import {
  classifyRoute,
  HOME_PATH,
  LOGIN_PATH,
} from './lib/auth-routes'

/**
 * Server-side route gate (Next.js 16 `proxy` convention — formerly `middleware`).
 *
 * Runs before any route renders, so it can redirect BEFORE protected/guest
 * content is ever sent to the browser — there is no client flash to exploit.
 *
 * Auth state is read from the non-sensitive `hanjeli_session` cookie, whose
 * value is the absolute session-expiry timestamp (ms). The cookie is NOT a
 * credential: forging it only changes navigation, never data access — every
 * API call is still authorized by the backend JWT guard. This layer exists to
 * make the navigation rules (bugs #3 and #4) impossible to bypass by simply
 * disabling JavaScript or racing the client guard.
 *
 * Finer preconditions that depend on sessionStorage (the 2FA challenge token
 * and the forgot-password intent — bug #5) cannot be seen here and are enforced
 * by the client-side RouteGuard.
 */
const SESSION_COOKIE = 'hanjeli_session'

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const routeClass = classifyRoute(pathname)

  // Public, OAuth callback, dan rute "open" (reset-password — link email harus
  // bekerja walau sedang login; prasyarat token diperiksa RouteGuard) selalu lolos.
  if (
    routeClass === 'public' ||
    routeClass === 'callback' ||
    routeClass === 'open'
  ) {
    return NextResponse.next()
  }

  const isAuthenticated = readSessionAuthenticated(request)

  // Bug #4 — logged-out users must not reach the dashboard.
  if (routeClass === 'protected' && !isAuthenticated) {
    const url = new URL(LOGIN_PATH, request.url)
    url.searchParams.set('reason', 'unauthenticated')
    return NextResponse.redirect(url)
  }

  // Bug #3 — logged-in users must not reach the auth screens.
  if (routeClass === 'guest' && isAuthenticated) {
    return NextResponse.redirect(new URL(HOME_PATH, request.url))
  }

  return NextResponse.next()
}

function readSessionAuthenticated(request: NextRequest): boolean {
  const raw = request.cookies.get(SESSION_COOKIE)?.value
  if (!raw) return false
  const expiresAt = Number(raw)
  return Number.isFinite(expiresAt) && expiresAt > Date.now()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     * - public assets
     */
    '/((?!_next/static|_next/image|favicon\\.ico|sitemap\\.xml|robots\\.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
