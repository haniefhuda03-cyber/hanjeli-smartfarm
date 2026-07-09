"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import Image from "next/image"
import { useTranslation } from "react-i18next"
import { ArrowLeft, CalendarClock, Cookie, FileText, ShieldCheck } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Chrome bersama untuk seluruh halaman legal publik (Kebijakan Privasi,
 * Syarat & Ketentuan, Pengaturan Cookie). Menjaga konsistensi visual dengan
 * design system "Organic Vitality" — permukaan cream, aksen daun, header
 * frost-glass, dan kartu konten neumorphic lembut.
 *
 * DRY: satu shell dipakai tiga halaman, sehingga navigasi silang, header,
 * dan footer tidak pernah drift.
 */

type LegalKey = "privacy" | "terms" | "cookies"

const NAV: { key: LegalKey; href: string; icon: typeof ShieldCheck }[] = [
  { key: "privacy", href: "/privacy", icon: ShieldCheck },
  { key: "terms", href: "/terms", icon: FileText },
  { key: "cookies", href: "/cookies", icon: Cookie },
]

export function LegalShell({
  current,
  icon,
  children,
}: {
  current: LegalKey
  icon: ReactNode
  children: ReactNode
}) {
  const { t } = useTranslation()

  return (
    <div className="relative min-h-screen bg-linear-to-b from-[#eef2e2] via-surface-soft to-[#e6ecd8] text-foreground">
      {/* ── Ambient organic glows (Organic Vitality) ── */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-40 -left-32 h-104 w-104 rounded-full bg-leaf/20 blur-3xl" />
        <div className="absolute top-1/4 -right-40 h-120 w-120 rounded-full bg-primary/12 blur-3xl" />
        <div className="absolute -bottom-24 left-1/3 h-96 w-96 rounded-full bg-surface-leaf/50 blur-3xl" />
      </div>

      {/* ── Frost-glass top bar ── */}
      <header
        className="sticky top-0 z-30 border-b border-white/50"
        style={{
          background: "rgba(250, 249, 244, 0.72)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
        }}
      >
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-5 py-3.5 lg:px-8">
          <Link href="/" className="group flex items-center gap-2.5" aria-label="Hanjeli">
            <Image
              src="/favicon.png"
              alt="Hanjeli Logo"
              width={34}
              height={34}
              className="h-8 w-8 rounded-xl object-cover ring-1 ring-black/5 transition-transform duration-300 group-hover:scale-105"
            />
            <span className="text-base font-bold tracking-tight">Hanjeli</span>
          </Link>

          <Link
            href="/"
            className="group inline-flex items-center gap-1.5 rounded-full bg-white/70 px-4 py-2 text-xs font-semibold text-primary shadow-sm ring-1 ring-black/5 transition-all duration-300 hover:-translate-y-0.5 hover:bg-primary hover:text-white hover:shadow-md hover:shadow-primary/30 active:scale-95"
          >
            <ArrowLeft className="h-3.5 w-3.5 transition-transform duration-300 group-hover:-translate-x-0.5" />
            {t("legal.backHome")}
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-4xl px-5 pb-20 pt-10 lg:px-8 lg:pt-14">
        {/* ── Page hero ── */}
        <div className="text-center">
          <div
            className="mx-auto flex h-18 w-18 items-center justify-center rounded-[1.4rem] text-primary ring-1 ring-primary/10"
            style={{
              background: "linear-gradient(145deg, #ffffff, #d9e2c8)",
              boxShadow:
                "12px 12px 26px rgba(0, 108, 73, 0.20), -10px -10px 24px rgba(255, 255, 255, 1), inset 0 1px 2px rgba(255, 255, 255, 0.9)",
            }}
          >
            {icon}
          </div>
          <h1 className="mt-6 font-display text-3xl font-bold tracking-tight text-primary-deepest sm:text-4xl">
            {t(`legal.${current}.title`)}
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-pretty text-sm leading-relaxed text-foreground/70 sm:text-base">
            {t(`legal.${current}.subtitle`)}
          </p>
          <span className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-primary/8 px-3.5 py-1.5 text-xs font-medium text-primary">
            <CalendarClock className="h-3.5 w-3.5" />
            {t("legal.lastUpdated")}: {t("legal.updatedDate")}
          </span>
        </div>

        {/* ── Cross-navigation ── */}
        <nav className="mt-8 flex flex-wrap items-center justify-center gap-2">
          {NAV.map(({ key, href, icon: Icon }) => {
            const active = key === current
            return (
              <Link
                key={key}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition-all",
                  active
                    ? "bg-primary text-white shadow-md shadow-primary/25"
                    : "bg-white/70 text-foreground/70 ring-1 ring-black/5 hover:bg-white hover:text-primary",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {t(`legal.nav.${key}`)}
              </Link>
            )
          })}
        </nav>

        {/* ── Content card ── */}
        <div
          className="mt-8 overflow-hidden rounded-3xl border border-white/70 bg-linear-to-b from-white/90 to-surface-soft/85 backdrop-blur-sm"
          style={{
            boxShadow:
              "0 24px 60px rgba(0, 33, 19, 0.10), inset 0 1px 0 rgba(255, 255, 255, 0.9)",
          }}
        >
          {/* leaf accent bar */}
          <div className="h-1.5 w-full bg-linear-to-r from-primary via-leaf-strong to-leaf" />
          <div className="p-6 sm:p-9 lg:p-11">{children}</div>
        </div>

        {/* ── Footer ── */}
        <footer className="mt-8 text-center">
          <p className="text-xs text-foreground/45">
            {t("landing.footerCopyright", { year: new Date().getFullYear() })}
          </p>
        </footer>
      </main>
    </div>
  )
}

/**
 * Renderer daftar-seksi untuk halaman berbasis teks (Privasi & Syarat).
 * Konten ditarik dari i18n via `returnObjects`, jadi copy tetap terpusat dan
 * mudah diterjemahkan.
 */
export type LegalSection = { heading: string; body: string[] }

export function LegalSections({ sections }: { sections: LegalSection[] }) {
  return (
    <div className="space-y-6 sm:space-y-8">
      {sections.map((section, i) => (
        <section
          key={section.heading}
          className="group relative overflow-hidden rounded-2xl bg-white/40 p-5 ring-1 ring-black/5 transition-all duration-300 hover:bg-white/70 hover:shadow-lg hover:shadow-primary/5 hover:ring-primary/20 sm:p-7"
        >
          {/* Subtle accent line on the left that glows on hover */}
          <div className="absolute inset-y-0 left-0 w-1.5 bg-primary/10 transition-colors duration-300 group-hover:bg-primary/50" />
          
          <h2 className="flex items-center gap-3.5 font-display text-lg font-bold tracking-tight text-primary-deepest sm:text-xl">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-xs font-bold text-primary shadow-inner transition-all duration-300 group-hover:scale-110 group-hover:bg-primary group-hover:text-white group-hover:shadow-md group-hover:shadow-primary/30 sm:h-10 sm:w-10 sm:text-sm"
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            {section.heading}
          </h2>
          
          <div className="mt-4 space-y-4 pl-0 sm:mt-5 sm:pl-13.5">
            {section.body.map((para, j) => (
              <p
                key={j}
                className="text-pretty text-sm leading-relaxed text-foreground/80 sm:text-[15px] sm:leading-7"
              >
                {para}
              </p>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
