"use client"

import Link from "next/link"
import { Home, Search } from "lucide-react"
import { useTranslation } from "react-i18next"

export default function NotFound() {
  const { t } = useTranslation()

  return (
    <div className="min-h-screen w-full bg-page flex items-center justify-center px-6">
      <div className="max-w-md w-full rounded-2xl bg-surface-sage p-8 text-center border border-white/70 neu-raised-lg">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-6 neu-inset">
          <Search className="h-8 w-8 text-primary" aria-hidden="true" />
        </div>
        <h1 className="text-5xl font-bold text-primary mb-2">404</h1>
        <h2 className="text-lg font-semibold text-foreground mb-2">
          {t('notFound.title', 'Halaman Tidak Ditemukan')}
        </h2>
        <p className="text-sm text-foreground/60 mb-6">
          {t('notFound.description', 'Maaf, halaman yang Anda cari tidak tersedia atau sudah dipindahkan.')}
        </p>
        <Link
          href="/home"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-semibold text-white transition-all active:scale-95 hover:shadow-lg neu-raised-sm"
          style={{
            background: 'linear-gradient(135deg, var(--primary) 0%, #00875c 100%)',
          }}
        >
          <Home className="h-4 w-4" aria-hidden="true" />
          {t('notFound.backHome', 'Kembali ke Beranda')}
        </Link>
      </div>
    </div>
  )
}
