"use client"

import Link from "next/link"
import Image from "next/image"
import { useTranslation } from "react-i18next"
import { Eye, EyeOff, AlertTriangle } from "lucide-react"
import { LoaderIcon } from "@/components/icons/toast-icons"
import { buildApiUrl } from "@/lib/runtime-config"

// Default auth hero — golden-hour green farmland.
// Source: https://images.unsplash.com/photo-1581369160694-c2ed42d5eac9 (Unsplash, verified to load)
const HERO_IMG = "https://images.unsplash.com/photo-1581369160694-c2ed42d5eac9?w=1200&q=80"

// Per-page distinct hero images — every auth screen uses its own photo so none
// repeats the landing/home hero. All from Unsplash (images.unsplash.com), load-verified.
export const AUTH_IMG = {
  // Login — golden-hour green field at sunset
  login: HERO_IMG,
  // Register — fresh seedlings sprouting (new account = new growth)
  register: "https://images.unsplash.com/photo-1457530378978-8bac673b8062?w=1200&q=80",
  // Forgot password — calm misty field at dawn (finding the way back)
  forgot: "https://images.unsplash.com/photo-1694517112518-3a355d01cc80?w=1200&q=80",
  // Reset password — dew drop on a green leaf (a fresh start)
  reset: "https://images.unsplash.com/photo-1474074001393-307cfca73703?w=1200&q=80",
  // Verify email — harvest baskets in the field
  verifyEmail: "https://images.unsplash.com/photo-1500651230702-0e2d8a49d4ad?w=1200&q=80",
  // Verify 2FA — aerial rice terraces (precision & oversight)
  verify2fa: "https://images.unsplash.com/photo-1513415756790-2ac1db1297d0?w=1200&q=80",
  // Recovery — aerial farmland at dusk
  recovery: "https://images.unsplash.com/photo-1596725217685-1315a39b80d4?w=1200&q=80",
} as const

/* ────────── Reusable auth UI primitives ────────── */
export function BrandMark() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <Image src="/favicon.png" alt="Hanjeli Logo" width={36} height={36} className="h-9 w-9 rounded-xl object-cover" />
      <span className="text-base font-bold tracking-tight text-foreground">Hanjeli</span>
    </Link>
  )
}

export function AuthVisual({ title, desc, imgSrc }: { title?: string; desc?: string; imgSrc?: string }) {
  const { t } = useTranslation()
  return (
    <div className="hidden lg:block w-1/2 relative">
      <Image src={imgSrc ?? HERO_IMG} alt="Smart farm" fill priority sizes="50vw" className="object-cover" />
      <div className="absolute inset-0 bg-linear-to-br from-primary-deepest/70 via-primary-deepest/35 to-primary-deepest/70" />

      <div className="absolute inset-0 flex flex-col justify-between p-10 xl:p-14">
        <div className="flex items-center gap-2.5">
          <Image src="/favicon.png" alt="Hanjeli Logo" width={40} height={40} className="h-10 w-10 rounded-xl object-cover" />
          <span className="text-lg font-bold tracking-tight text-white">Hanjeli</span>
        </div>

        <div className="space-y-3 max-w-md">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-leaf px-3 py-1 text-[11px] font-semibold text-primary-deepest">
            {t('landing.hero.badge')}
          </span>
          <h2 className="font-display text-2xl xl:text-3xl font-bold text-white leading-tight text-balance">
            {title ?? t('landing.hero.title')}
          </h2>
          <p className="text-sm text-white/80 leading-relaxed text-pretty line-clamp-3">
            {desc ?? t('landing.hero.subtitle')}
          </p>
        </div>
      </div>
    </div>
  )
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-medium uppercase tracking-wider text-foreground/60">{children}</label>
}

export function FieldGroup({ children }: { children: React.ReactNode }) {
  return <div className="relative -mt-1.5">{children}</div>
}

export function authInputClass({ withRight = false }: { withRight?: boolean } = {}) {
  return [
    "h-11 rounded-2xl border border-border/70 bg-white pl-11 text-sm text-foreground placeholder:text-foreground/40",
    "focus:outline-none focus:border-leaf-strong focus:ring-2 focus:ring-leaf-strong/20",
    withRight ? "pr-12" : "pr-4",
  ].join(" ")
}

export function PasswordToggle({ show, onToggleAction, t }: { show: boolean; onToggleAction: () => void; t: ReturnType<typeof useTranslation>["t"] }) {
  return (
    <button
      type="button"
      onClick={onToggleAction}
      aria-label={show ? t('auth.hidePassword', 'Sembunyikan kata sandi') : t('auth.showPassword', 'Tampilkan kata sandi')}
      className="absolute right-3 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full text-foreground/50 hover:text-primary hover:bg-leaf/20 transition"
    >
      {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  )
}

export function ErrorBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-2xl bg-error-container/60 border border-error/30 px-4 py-3" role="alert">
      <AlertTriangle className="h-4 w-4 text-error shrink-0 mt-0.5" aria-hidden="true" />
      <p className="text-sm text-on-error-container font-medium leading-snug">{children}</p>
    </div>
  )
}

export function Divider({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-3 flex items-center gap-4">
      <div className="h-px flex-1 bg-border/60" />
      <span className="text-xs text-foreground/50">{children}</span>
      <div className="h-px flex-1 bg-border/60" />
    </div>
  )
}

export function GoogleButton({ label }: { label: string }) {
  const handleGoogleAuth = () => {
    window.location.href = buildApiUrl("/auth/google")
  }

  return (
    <button
      type="button"
      onClick={handleGoogleAuth}
      aria-label={label}
      className="flex h-11 w-full items-center justify-center gap-3 rounded-2xl border border-border/70 bg-white text-sm font-medium text-foreground transition-all hover:bg-surface-sage/30 hover:border-leaf-strong/50"
    >
      <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
      </svg>
      <span>{label}</span>
    </button>
  )
}

export function AuthLoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-soft p-5">
      <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-primary/20 bg-primary/3 p-8 text-center max-w-sm w-full">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <LoaderIcon className="h-6.5 w-6.5" />
        </span>
        <div className="space-y-1">
          <p className="text-base font-semibold text-primary">
            Memuat data...
          </p>
          <p className="max-w-xs text-xs text-primary/60">
            Sedang mengambil informasi terbaru dari server.
          </p>
        </div>
      </div>
    </div>
  )
}
