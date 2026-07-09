import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Derive up-to-2-letter initials from a full name for avatar fallbacks.
 * "Hanief Huda" -> "HH", "Budi" -> "BU", "" -> "".
 */
export function getInitials(name?: string | null): string {
  if (!name) return ""
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ""
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
