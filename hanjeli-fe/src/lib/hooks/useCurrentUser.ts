import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/api/query-keys"
import { usersApi } from "@/lib/api/users"
import { getStoredUser, storeCurrentUser, hasValidSession } from "@/lib/auth-session"

export type CurrentUser = {
  id: string
  name: string
  email: string
  role: string
  avatar_url: string | null
  two_factor_enabled?: boolean
  email_verified?: boolean
  google_id?: string | null
  password_updated_at?: string | null
}

/**
 * Single source of truth for the logged-in user's identity.
 *
 * Reads the cached user from localStorage for an instant first paint, then
 * refreshes from GET /users/me. Shares the React Query cache key with the
 * profile page (queryKeys.auth.profile) so identity stays consistent app-wide.
 */
export function useCurrentUser() {
  const stored = getStoredUser()
  const [hasSession, setHasSession] = useState(false)

  // Wait for mount to check localStorage safely
  useEffect(() => { 
    setHasSession(hasValidSession())
  }, [])

  const query = useQuery({
    queryKey: queryKeys.auth.profile,
    queryFn: usersApi.getMe,
    initialData: stored ?? undefined,
    staleTime: 60_000,
    enabled: hasSession,
  })

  const user = query.data as CurrentUser | undefined
  const [mounted, setMounted] = useState(false)

  // Avoid hydration mismatch by waiting for mount
  useEffect(() => { setMounted(true) }, [])

  // Sync fresh React Query data back to localStorage so that 
  // on next refresh, the initialData is the most up-to-date.
  useEffect(() => {
    if (query.data && mounted) {
      storeCurrentUser(query.data as any)
    }
  }, [query.data, mounted])

  return {
    user,
    isLoading: query.isLoading,
    isError: query.isError,
    name: user?.name ?? "",
    email: user?.email ?? "",
    role: user?.role ?? "Guest",
    avatarUrl: user?.avatar_url ?? null,
    twoFactorEnabled: Boolean(user?.two_factor_enabled),
    isAdmin: (user?.role ?? "") === "Admin",
    passwordUpdatedAt: user?.password_updated_at ?? null,
  }
}
