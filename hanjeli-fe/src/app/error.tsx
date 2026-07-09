"use client"

import { useEffect } from "react"
import { useTranslation } from "react-i18next"
import { AlertTriangle, RefreshCw } from "lucide-react"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const { t } = useTranslation()

  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-screen w-full bg-page flex items-center justify-center px-6">
      <div className="max-w-md w-full rounded-2xl bg-surface-sage p-8 text-center border border-white/70 neu-raised-lg">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 mb-6 neu-inset">
          <AlertTriangle className="h-8 w-8 text-destructive" />
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">
          {t('error.title', 'Terjadi Kesalahan')}
        </h2>
        <p className="text-sm text-foreground/60 mb-6">
          {t('error.description', 'Maaf, terjadi kesalahan yang tidak terduga. Silakan coba muat ulang halaman.')}
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-semibold text-white transition-all active:scale-95 neu-raised-sm"
          style={{
            background: 'linear-gradient(135deg, var(--primary) 0%, #00875c 100%)',
          }}
        >
          <RefreshCw className="h-4 w-4" />
          {t('error.retry', 'Coba Lagi')}
        </button>
      </div>
    </div>
  )
}
