const DEFAULT_API_URL = "http://localhost:3000/api/v3"

export function getApiBaseUrl() {
  // Accept either env var name so the two axios clients never drift apart.
  return (
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    DEFAULT_API_URL
  )
}

export function buildApiUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`
  return `${getApiBaseUrl()}${normalizedPath}`
}

export function getApiOriginUrl() {
  try {
    return new URL(getApiBaseUrl()).origin
  } catch {
    return DEFAULT_API_URL.replace("/api/v3", "")
  }
}

export function getSocketUrl() {
  return process.env.NEXT_PUBLIC_WS_URL || `${getApiOriginUrl()}/ws`
}
