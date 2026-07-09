"use client"

import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Check, Cookie, Lock, Save, ShieldCheck, Sparkles, X } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { LegalShell } from "@/components/legal/legal-shell"
import { useNotifications } from "@/contexts/notification-context"
import { cn } from "@/lib/utils"

/**
 * Kategori cookie yang dikelola. `essential` selalu aktif dan tidak dapat
 * dimatikan (prasyarat agar aplikasi berfungsi). Sisanya opsional dan
 * default-nya OFF — menghormati privasi pengguna (opt-in, bukan opt-out).
 */
const CATEGORY_IDS = ["essential", "analytics", "functional", "marketing"] as const
type CategoryId = (typeof CATEGORY_IDS)[number]

type Preferences = Record<CategoryId, boolean>

const STORAGE_KEY = "hanjeli_cookie_prefs"

const DEFAULT_PREFS: Preferences = {
  essential: true,
  analytics: false,
  functional: false,
  marketing: false,
}

const CATEGORY_ICON: Record<CategoryId, typeof ShieldCheck> = {
  essential: Lock,
  analytics: Sparkles,
  functional: Cookie,
  marketing: Sparkles,
}

/** Baca preferensi tersimpan dengan aman (menoleransi data lama/rusak). */
function readStoredPrefs(): Preferences {
  if (typeof window === "undefined") return DEFAULT_PREFS
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_PREFS
    const parsed = JSON.parse(raw) as Partial<Preferences>
    return {
      essential: true, // selalu aktif, apa pun isi storage
      analytics: Boolean(parsed.analytics),
      functional: Boolean(parsed.functional),
      marketing: Boolean(parsed.marketing),
    }
  } catch {
    return DEFAULT_PREFS
  }
}

export default function CookiesPage() {
  const { t } = useTranslation()
  const { addNotification } = useNotifications()
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFS)
  const [hydrated, setHydrated] = useState(false)

  // Sinkron dengan localStorage setelah mount (hindari hydration mismatch).
  useEffect(() => {
    setPrefs(readStoredPrefs())
    setHydrated(true)
  }, [])

  const toggle = (id: CategoryId, value: boolean) => {
    if (id === "essential") return // tidak bisa dimatikan
    setPrefs((prev) => ({ ...prev, [id]: value }))
  }

  const persist = (next: Preferences) => {
    setPrefs(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      /* storage penuh / diblokir — abaikan, preferensi tetap berlaku di sesi ini */
    }
  }

  const notifySaved = (message: string) => {
    addNotification({
      title: t("legal.cookies.savedTitle"),
      description: message,
      type: "success",
      category: "system",
    })
  }

  const handleSave = () => {
    persist(prefs)
    notifySaved(t("legal.cookies.savedToast"))
  }

  const handleAcceptAll = () => {
    const all: Preferences = { essential: true, analytics: true, functional: true, marketing: true }
    persist(all)
    notifySaved(t("legal.cookies.acceptedToast"))
  }

  const handleRejectAll = () => {
    persist({ ...DEFAULT_PREFS })
    notifySaved(t("legal.cookies.rejectedToast"))
  }

  return (
    <LegalShell current="cookies" icon={<Cookie className="h-8 w-8" strokeWidth={1.75} />}>
      <p className="mb-7 text-pretty text-sm leading-relaxed text-foreground/80 sm:text-[15px] sm:leading-7">
        {t("legal.cookies.intro")}
      </p>

      {/* ── Quick actions ── */}
      <div className="mb-8 flex flex-col gap-2.5 sm:flex-row">
        <button
          type="button"
          onClick={handleAcceptAll}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white shadow-md shadow-primary/25 transition-all hover:brightness-105 active:scale-[0.98]"
        >
          <Check className="h-4 w-4" />
          {t("legal.cookies.acceptAll")}
        </button>
        <button
          type="button"
          onClick={handleRejectAll}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-foreground/70 ring-1 ring-black/10 transition-all hover:bg-black/3 active:scale-[0.98]"
        >
          <X className="h-4 w-4" />
          {t("legal.cookies.rejectAll")}
        </button>
      </div>

      {/* ── Category toggles ── */}
      <div className="space-y-4">
        {CATEGORY_IDS.map((id) => {
          const Icon = CATEGORY_ICON[id]
          const required = id === "essential"
          const checked = required ? true : prefs[id]
          return (
            <div
              key={id}
              className={cn(
                "flex items-start gap-4 rounded-2xl border p-4 sm:p-5 transition-colors",
                checked ? "border-primary/25 bg-primary/4" : "border-black/8 bg-white/60",
              )}
            >
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                  checked ? "bg-primary/12 text-primary" : "bg-black/5 text-foreground/50",
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={1.9} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-display text-sm font-bold text-primary-deepest sm:text-base">
                    {t(`legal.cookies.categories.${id}.name`)}
                  </h3>
                  {required && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                      <Lock className="h-2.5 w-2.5" />
                      {t("legal.cookies.alwaysOn")}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-foreground/65 sm:text-[13px]">
                  {t(`legal.cookies.categories.${id}.desc`)}
                </p>
              </div>

              <Switch
                checked={checked}
                onCheckedChange={(v) => toggle(id, v)}
                disabled={required || !hydrated}
                aria-label={t(`legal.cookies.categories.${id}.name`)}
                className="mt-1 shrink-0"
              />
            </div>
          )
        })}
      </div>

      {/* ── Save ── */}
      <div className="mt-8 flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={!hydrated}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary-deepest px-6 py-3 text-sm font-semibold text-white shadow-md transition-all hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          {t("legal.cookies.save")}
        </button>
      </div>

      {/* ── About cookies ── */}
      <div className="mt-10 border-t border-black/8 pt-8">
        <h2 className="font-display text-lg font-bold text-primary-deepest sm:text-xl">
          {t("legal.cookies.aboutTitle")}
        </h2>
        <div className="mt-3 space-y-3 text-sm leading-relaxed text-foreground/75 sm:text-[15px] sm:leading-7">
          {(t("legal.cookies.about", { returnObjects: true }) as string[]).map((para, i) => (
            <p key={i} className="text-pretty">
              {para}
            </p>
          ))}
        </div>
      </div>
    </LegalShell>
  )
}
