import { User } from "lucide-react"
import { cn, getInitials } from "@/lib/utils"

type UserAvatarProps = {
  /** Resolved avatar image URL, or null/undefined to show a fallback. */
  src?: string | null
  /** Full name — used for the alt text and the initials fallback. */
  name?: string | null
  /** Classes for the circular container (size, ring, background, etc.). */
  className?: string
  /** Classes for the fallback icon / initials (size + colour). */
  iconClassName?: string
}

/**
 * Single source of truth for rendering a user's avatar across the app.
 * Shows the uploaded photo when available, otherwise the name initials,
 * otherwise a neutral user icon. Uses a plain <img> on purpose so avatars
 * served from the backend origin don't need next/image remotePatterns.
 */
export function UserAvatar({ src, name, className, iconClassName }: UserAvatarProps) {
  const initials = getInitials(name)
  return (
    <div
      className={cn(
        "flex items-center justify-center overflow-hidden rounded-full bg-success",
        className,
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={name ? `Foto profil ${name}` : "Foto profil"}
          className="h-full w-full object-cover"
        />
      ) : initials ? (
        <span
          className={cn(
            "inline-flex items-center justify-center font-semibold text-primary leading-none uppercase select-none",
            iconClassName,
          )}
        >
          {initials}
        </span>
      ) : (
        <User className={cn("text-primary", iconClassName)} aria-hidden="true" />
      )}
    </div>
  )
}
