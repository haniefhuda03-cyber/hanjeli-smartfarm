"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import Link from "next/link"
import Image from "next/image"
import {
  ArrowRight,
  Bug,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  CloudSun,
  Cpu,
  Droplets,
  Instagram,
  Leaf,
  Linkedin,
  LogIn,
  Mail,
  MapPin,
  Menu,
  Phone,
  Play,
  Plus,
  Sparkles,
  Sprout,
  UserPlus,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { motion, type Variants } from "framer-motion"

/* ──────────── Sistem animasi landing (v2) ────────────
 * Karakter baru: "rise + unblur" untuk teks (muncul tajam dari kabur),
 * "curtain reveal" untuk gambar (tirai clip terbuka + zoom-out halus),
 * dan spring pop untuk kartu. Parent `stagger` mengurutkan anak-anaknya
 * per-komponen; `once: false` memutar ulang animasi saat scroll turun
 * maupun naik.
 */
const EASE = [0.22, 1, 0.36, 1] as const

/**
 * CSS-only scroll reveal hook — SSR safe, no hydration mismatch.
 * Returns a callback-ref to attach to each card element.
 * Collects elements first, then observes them after a paint frame.
 */
function useScrollReveal() {
  const elements = useRef<Set<HTMLElement>>(new Set())

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible")
            entry.target.setAttribute("data-visible", "true")
            // Also reveal inner text with its own delay
            const textEl = entry.target.querySelector(".scroll-reveal-text")
            if (textEl) {
              textEl.classList.add("is-visible")
              textEl.setAttribute("data-visible", "true")
            }
            observer.unobserve(entry.target)
          }
        })
      },
      { rootMargin: "-40px", threshold: 0.05 }
    )

    // Wait one animation frame so browser paints the initial opacity:0 state
    // before we start observing (prevents instant is-visible on already-visible elements)
    const raf = requestAnimationFrame(() => {
      elements.current.forEach((el) => observer.observe(el))
    })

    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
    }
  }, [])

  const ref = useCallback((el: HTMLElement | null) => {
    if (el) {
      elements.current.add(el)
    }
  }, [])

  return ref
}
const VIEWPORT = { once: true, amount: 0.2 } as const

const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
}

/* Teks: naik + unblur — terasa "fokus" saat masuk viewport */
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 36, filter: "blur(8px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.65, ease: EASE },
  },
}

/* Gambar: tirai terbuka dari kiri + zoom-out halus */
const fadeLeft: Variants = {
  hidden: { opacity: 0, clipPath: "inset(0 100% 0 0)", scale: 1.06 },
  show: {
    opacity: 1,
    clipPath: "inset(0 0% 0 0)",
    scale: 1,
    transition: { duration: 0.85, ease: EASE },
  },
}

/* Kartu/panel dari kanan: spring pop dengan sedikit scale */
const fadeRight: Variants = {
  hidden: { opacity: 0, x: 48, scale: 0.96 },
  show: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 110, damping: 16, mass: 0.9 },
  },
}

/* Kartu grid: fade up halus tanpa efek menyentak atau scaling */
const cardPop: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: EASE },
  },
}

// Unsplash farm imagery — remotePatterns already whitelists images.unsplash.com (next.config.ts).
// Each slot uses a distinct photo to avoid repetition across the page.
const IMG = {
  // Hero — Local image
  hero: "/background_utama.jpg",
  // Hero side card — Local image
  heroCard: "/side_cardhero.jpg",
  // About left — Local image (Millet seed)
  aboutLeft: "/millet_seed.jpg",
  // Innovation 1 (sensor monitoring)
  innov1: "/weather1.jpg",
  // Innovation 2 (auto-irrigation)
  innov2: "/penyiraman.jpg",
  // Innovation 3 (education/preservation)
  innov3: "/localfood.jpg",
  // Innovation 4 (weather forecast)
  innov4: "/weather-station1.jpg",
  // Innovation 5 (AI pest detection)
  innov5: "/ai.jpg",
  // Innovation 6 (AI recommendations)
  innov6: "/laptop.jpg",
  // Testimonial 1 — Sandiaga Uno
  testimonial1: "/sandiuno2.jpg",
  // Testimonial 2 — Benny Bachtiar
  testimonial2: "/Benny_Bachtiar.jpg",
  // Testimonial 3 — Marwan Hamami
  testimonial3: "/marwanhamami.jpg",
  // Abah Asep — founder of Desa Wisata Hanjeli
  abahAsep: "/abah_asep.jpg",
  // FAQ
  faq: "/faq.jpg",
}
const NAV_ITEMS = [
  { key: "navHome", href: "#hero" },
  { key: "navAbout", href: "#about" },
  { key: "navInnovation", href: "#service" },
  { key: "navTestimonial", href: "#trust" },
  { key: "navFaq", href: "#faq" },
  { key: "contactUs", href: "#footer" },
] as const

export default function LandingPage() {
  const { t } = useTranslation()
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : ""
    return () => { document.body.style.overflow = "" }
  }, [mobileOpen])

  return (
    <div className="min-h-screen bg-surface-soft text-foreground font-sans">
      <TopNav scrolled={scrolled} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} t={t} />
      <Hero t={t} />
      <AboutSection t={t} />
      <InnovationSection t={t} />
      <TestimonialsSection t={t} />
      <FaqSection t={t} />
      <Footer t={t} />
    </div>
  )
}

type TFn = ReturnType<typeof useTranslation>["t"]

/* ──────────── Top Navigation ──────────── */
function TopNav({
  scrolled,
  mobileOpen,
  setMobileOpen,
  t,
}: {
  scrolled: boolean
  mobileOpen: boolean
  setMobileOpen: (v: boolean) => void
  t: TFn
}) {
  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-300",
        scrolled
          ? "bg-primary-deepest/85 backdrop-blur-md shadow-[0_4px_20px_-6px_rgba(0,0,0,0.4)]"
          : "bg-linear-to-b from-primary-deepest/80 via-primary-deepest/30 to-transparent",
      )}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-10">
        {/* Logo */}
        <Link href="#hero" className="flex items-center gap-2.5">
          <Image src="/favicon.png" alt="Hanjeli Logo" width={36} height={36} className="h-9 w-9 rounded-xl object-cover" />
          <span className="text-lg font-bold tracking-tight text-white">{t("landing.brand")}</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden lg:flex items-center gap-1">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.key}
              href={item.href}
              className="rounded-full px-4 py-2 text-sm font-medium text-white/85 transition-colors hover:bg-white/10 hover:text-white"
            >
              {t(`landing.${item.key}`)}
            </a>
          ))}
        </nav>

        {/* Desktop Auth Buttons */}
        <div className="hidden lg:flex items-center gap-2.5">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/20"
          >
            <LogIn className="h-4 w-4" />
            {t("landing.navLogin")}
          </Link>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 rounded-full bg-leaf px-5 py-2.5 text-sm font-semibold text-primary-deepest transition-all hover:bg-leaf-strong hover:shadow-lg hover:shadow-leaf/30"
          >
            <UserPlus className="h-4 w-4" />
            {t("landing.navRegister")}
          </Link>
        </div>

        {/* Mobile button */}
        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 lg:hidden"
          aria-label={mobileOpen ? t("landing.closeMenu") : t("landing.openMenu")}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="lg:hidden bg-primary-deepest/95 backdrop-blur-md border-t border-white/10">
          <nav className="mx-auto flex max-w-7xl flex-col gap-1 px-5 py-4">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.key}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-2xl px-4 py-3 text-sm font-medium text-white/85 transition-colors hover:bg-white/10 hover:text-white"
              >
                {t(`landing.${item.key}`)}
              </a>
            ))}
            <Link
              href="/login"
              onClick={() => setMobileOpen(false)}
              className="mt-2 rounded-2xl bg-white/10 px-4 py-3 text-center text-sm font-semibold text-white"
            >
              {t("landing.navLogin")}
            </Link>
            <Link
              href="/register"
              onClick={() => setMobileOpen(false)}
              className="mt-1 rounded-2xl bg-leaf px-4 py-3 text-center text-sm font-semibold text-primary-deepest"
            >
              {t("landing.navRegister")}
            </Link>
          </nav>
        </div>
      )}
    </header>
  )
}

/* ──────────── Hero ──────────── */
function Hero({ t }: { t: TFn }) {
  return (
    <section id="hero" className="relative">
      {/* Full-bleed hero so the fixed top nav reads over the dark image (matches reference) */}
      <div className="relative h-[600px] sm:h-[680px] lg:h-[760px]">
        <Image
          src={IMG.hero}
          alt="Smart farm landscape"
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        {/* Dark overlay — stronger at top (nav legibility) and bottom (headline legibility) */}
        <div className="absolute inset-0 bg-linear-to-b from-primary-deepest/70 via-primary-deepest/25 to-primary-deepest/60" />

        {/* Content — kept within max-w-7xl to align with the rest of the page */}
        <div className="absolute inset-0 flex flex-col">
          <div className="mx-auto w-full max-w-7xl flex-1 flex flex-col px-5 sm:px-10 lg:px-14 pt-24 pb-12 lg:pb-20">
            {/* Satu parent stagger — headline, subtitle, CTA, dan kartu samping
                muncul berurutan per-komponen, bukan serentak. */}
            <motion.div
              variants={stagger}
              initial="hidden"
              animate="show"
              className="mt-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 lg:items-end"
            >
              {/* Headline */}
              <div className="lg:col-span-7 text-white">
                <motion.h1
                  variants={fadeUp}
                  className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.05] tracking-tight text-balance"
                >
                  {t("landing.hero.title")}
                </motion.h1>
                <motion.p
                  variants={fadeUp}
                  className="mt-5 max-w-xl text-base sm:text-lg text-white/85 leading-relaxed text-pretty"
                >
                  {t("landing.hero.subtitle")}
                </motion.p>
                <motion.div variants={fadeUp} className="mt-7 flex flex-wrap items-center gap-3">
                  <Link
                    href="/login"
                    className="group inline-flex items-center gap-2 rounded-full bg-leaf px-6 py-3.5 text-sm font-semibold text-primary-deepest transition-all hover:bg-leaf-strong hover:shadow-xl hover:shadow-leaf/30"
                  >
                    {t("landing.hero.ctaStart")}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </motion.div>
              </div>

              {/* Hero side card */}
              <motion.div
                variants={fadeRight}
                className="lg:col-span-5 flex justify-start lg:justify-end"
              >
                <div className="w-full max-w-sm rounded-3xl bg-white/10 backdrop-blur-xl border border-white/20 p-3 shadow-2xl">
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-leaf px-3 py-1 text-[11px] font-semibold text-primary-deepest mb-3">
                    <Sprout className="h-3 w-3" />
                    {t("landing.hero.badge")}
                  </div>
                  <div className="relative h-44 sm:h-52 overflow-hidden rounded-2xl">
                    <Image
                      src={IMG.heroCard}
                      alt="Farmer in field"
                      fill
                      sizes="400px"
                      className="object-cover"
                    />
                  </div>
                  <p className="mt-3 px-1 text-sm text-white leading-snug">
                    <span className="text-2xl font-bold">{t("landing.aboutStat2Value")}</span>{" "}
                    <span className="text-white/80">{t("landing.hero.cardText")}</span>
                  </p>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ──────────── About / Stats ──────────── */
function AboutSection({ t }: { t: TFn }) {
  const [isVideoPlaying, setIsVideoPlaying] = useState(false)

  return (
    <section id="about" className="py-16 lg:py-24 px-5 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <SectionEyebrow label={t("landing.aboutEyebrow")} />
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          {/* Left: feature image + location chip / Video Frame */}
          <motion.div
            variants={fadeLeft}
            initial="hidden"
            whileInView="show"
            viewport={VIEWPORT}
            className="relative"
          >
            <div className="relative h-72 sm:h-96 lg:h-120 overflow-hidden rounded-[28px] shadow-[0_24px_60px_-24px_rgba(0,108,73,0.45)] group">
              {!isVideoPlaying ? (
                <>
                  <Image
                    src={IMG.aboutLeft}
                    alt="Desa Wisata Hanjeli"
                    fill
                    sizes="(max-width: 1024px) 100vw, 600px"
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-colors duration-300" />
                  
                  {/* Play Button Overlay */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <button
                      onClick={() => setIsVideoPlaying(true)}
                      className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-white shadow-xl transition-all duration-300 hover:scale-110 hover:bg-leaf/90 focus:outline-none focus:ring-4 focus:ring-leaf/50"
                      aria-label="Tonton video pengenalan Hanjeli"
                    >
                      <Play className="h-6 w-6 ml-1" fill="currentColor" />
                    </button>
                  </div>
                  
                  <div className="absolute bottom-4 left-4 inline-flex items-center gap-2 rounded-full bg-white/90 backdrop-blur px-4 py-2 shadow-lg">
                    <MapPin className="h-4 w-4 text-leaf-strong shrink-0" />
                    <span className="text-xs font-semibold text-foreground">{t("landing.aboutLocation")}</span>
                  </div>
                </>
              ) : (
                <iframe
                  className="absolute inset-0 w-full h-full bg-black"
                  src="https://www.youtube.com/embed/Iboix_xxUc4?autoplay=1"
                  title="Kenali Desa Wisata Hanjeli"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                ></iframe>
              )}
            </div>
          </motion.div>

          {/* Right: heading, tiap paragraf, dan kutipan muncul berurutan —
              sebelumnya satu blok monolitik yang tampil serentak. */}
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={VIEWPORT}
          >
            <motion.h2
              variants={fadeUp}
              className="font-display text-3xl lg:text-4xl font-bold leading-tight text-foreground text-balance"
            >
              {t("landing.aboutHeading")}
            </motion.h2>

            <div className="mt-5 space-y-4 text-base text-foreground/70 leading-relaxed">
              <motion.p variants={fadeUp}>{t("landing.aboutBody1")}</motion.p>
              <motion.p variants={fadeUp}>{t("landing.aboutBody2")}</motion.p>
              <motion.p variants={fadeUp}>{t("landing.aboutBody3")}</motion.p>
            </div>

            <motion.figure
              variants={fadeUp}
              className="mt-7 relative overflow-hidden rounded-2xl bg-surface-sage-soft border-l-4 border-leaf-strong p-5 lg:p-6"
            >
              <span aria-hidden className="pointer-events-none absolute right-4 top-1 font-display text-7xl leading-none text-leaf-strong/15 select-none">&rdquo;</span>
              <blockquote className="relative text-base lg:text-lg italic text-foreground/85 leading-relaxed mb-4">
                {t("landing.aboutQuote")}
              </blockquote>
              <div className="flex items-center gap-3">
                <div className="relative h-16 w-16 shrink-0 aspect-square overflow-hidden rounded-full border border-leaf-strong/20 bg-neutral-100">
                  <Image src={IMG.abahAsep} alt={t("landing.aboutQuoteAuthor")} fill sizes="48px" className="object-cover scale-103" />
                </div>
                <div>
                  <figcaption className="text-sm font-bold text-leaf-strong">{t("landing.aboutQuoteAuthor")}</figcaption>
                  <p className="text-[11px] text-foreground/50 font-medium">{t("landing.aboutQuoteAuthorRole")}</p>
                </div>
              </div>
            </motion.figure>
          </motion.div>
        </div>
      </div>
    </section>
  )
}



/* ──────────── Innovation & Technology Section ──────────── */
function InnovationSection({ t }: { t: TFn }) {
  const revealRef = useScrollReveal()

  const cards = [
    { img: IMG.innov1, title: t("landing.innovCard1Title"), desc: t("landing.innovCard1Desc"), icon: Cpu, soon: false },
    { img: IMG.innov2, title: t("landing.innovCard2Title"), desc: t("landing.innovCard2Desc"), icon: Droplets, soon: false },
    { img: IMG.innov3, title: t("landing.innovCard3Title"), desc: t("landing.innovCard3Desc"), icon: Leaf, soon: false },
    { img: IMG.innov4, title: t("landing.innovCard4Title"), desc: t("landing.innovCard4Desc"), icon: CloudSun, soon: true },
    { img: IMG.innov5, title: t("landing.innovCard5Title"), desc: t("landing.innovCard5Desc"), icon: Bug, soon: true },
    { img: IMG.innov6, title: t("landing.innovCard6Title"), desc: t("landing.innovCard6Desc"), icon: Sparkles, soon: true, imgClass: "object-[center_20%]" },
  ]

  return (
    <section id="service" className="py-12 lg:py-20 px-5 lg:px-10 bg-surface-sage-soft">
      <div className="mx-auto max-w-7xl">
        <SectionEyebrow label={t("landing.innovEyebrow")} />

        {/* Header: judul dan subjudul muncul berurutan */}
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={VIEWPORT}
          className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-end"
        >
          <motion.div variants={fadeUp} className="lg:col-span-6">
            <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold leading-tight text-foreground text-balance">
              {t("landing.innovHeading")}
            </h2>
          </motion.div>
          <motion.div variants={fadeUp} className="lg:col-span-6">
            <p className="text-sm sm:text-base text-foreground/60 leading-relaxed">
              {t("landing.innovSubheading")}
            </p>
          </motion.div>
        </motion.div>

        {/* Top row: 3 cards — CSS scroll reveal (anti hydration flicker) */}
        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-5">
          {cards.slice(0, 3).map((c, idx) => {
            const Icon = c.icon
            return (
              <article
                key={c.title}
                ref={revealRef}
                className="scroll-reveal-card group rounded-3xl bg-white overflow-hidden border border-border/40 hover:shadow-xl hover:-translate-y-1.5 hover:ring-2 hover:ring-leaf/50 focus-within:ring-2 focus-within:ring-leaf h-full flex flex-col relative"
                style={{ "--reveal-delay": `${idx * 150}ms` } as React.CSSProperties}
              >
                <div className="relative h-44 overflow-hidden shrink-0">
                  <Image src={c.img} alt={c.title} fill sizes="(max-width: 768px) 100vw, 400px" className={cn("object-cover transition-transform duration-500 group-hover:scale-105", c.imgClass)} />
                </div>
                <div className="p-5 lg:p-6 flex-1 flex flex-col justify-start relative z-10">
                  <div className="inline-flex h-14 w-14 items-center justify-center rounded-xl bg-[#E8F3ED] text-leaf-strong -mt-10 mb-3 ring-4 ring-white shadow-sm relative z-20">
                    <Icon className="h-7 w-7" />
                  </div>
                  <div className="scroll-reveal-text" style={{ "--reveal-delay": `${(idx * 150) + 250}ms` } as React.CSSProperties}>
                    <h3 className="font-display text-lg font-bold text-foreground group-hover:text-leaf-strong transition-colors">{c.title}</h3>
                    <p className="mt-2 text-sm text-foreground/60 leading-relaxed">{c.desc}</p>
                  </div>
                </div>
              </article>
            )
          })}
        </div>

        {/* Bottom row: 3 Coming Soon cards — CSS scroll reveal */}
        <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-5">
          {cards.slice(3).map((c, idx) => {
            const Icon = c.icon
            return (
              <article
                key={c.title}
                ref={revealRef}
                className="scroll-reveal-card group rounded-3xl bg-white overflow-hidden border border-border/40 hover:shadow-xl hover:-translate-y-1.5 hover:ring-2 hover:ring-amber-400/50 focus-within:ring-2 focus-within:ring-amber-400 h-full flex flex-col relative"
                style={{ "--reveal-delay": `${idx * 150}ms` } as React.CSSProperties}
              >
                <div className="relative h-44 overflow-hidden shrink-0">
                  <Image src={c.img} alt={c.title} fill sizes="(max-width: 768px) 100vw, 400px" className={cn("object-cover transition-transform duration-500 group-hover:scale-105", c.imgClass)} />
                  {/* Coming Soon badge */}
                  <div className="absolute top-3 right-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-amber-500/90 backdrop-blur-sm px-3 py-1.5 shadow-lg">
                    <span className="relative flex h-2 w-2">
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-white opacity-80" />
                    </span>
                    <span className="text-xs font-bold text-white tracking-wide">{t("landing.comingSoon")}</span>
                  </div>
                </div>
                <div className="p-5 lg:p-6 flex-1 flex flex-col justify-start relative z-10">
                  <div className="inline-flex h-14 w-14 items-center justify-center rounded-xl bg-[#FFF3E0] text-amber-700 -mt-10 mb-3 ring-4 ring-white shadow-sm relative z-20">
                    <Icon className="h-7 w-7" />
                  </div>
                  <div className="scroll-reveal-text" style={{ "--reveal-delay": `${(idx * 150) + 250}ms` } as React.CSSProperties}>
                    <h3 className="font-display text-lg font-bold text-foreground group-hover:text-amber-600 transition-colors">{c.title}</h3>
                    <p className="mt-2 text-sm text-foreground/60 leading-relaxed">{c.desc}</p>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}

/* ──────────── Testimonials ──────────── */
function TestimonialsSection({ t }: { t: TFn }) {
  const revealRef = useScrollReveal()

  /* Foto pejabat ditampilkan default (object-cover) tanpa zoom/offset crop */
  const items = [
    {
      quote: t("landing.testimonial1Quote"),
      name: t("landing.testimonial1Name"),
      role: t("landing.testimonial1Role"),
      img: IMG.testimonial1,
    },
    {
      quote: t("landing.testimonial2Quote"),
      name: t("landing.testimonial2Name"),
      role: t("landing.testimonial2Role"),
      img: IMG.testimonial2,
    },
    {
      quote: t("landing.testimonial3Quote"),
      name: t("landing.testimonial3Name"),
      role: t("landing.testimonial3Role"),
      img: IMG.testimonial3,
    },
  ]
  return (
    <section id="trust" className="py-12 lg:py-20 px-5 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <SectionEyebrow label={t("landing.trustEyebrow")} />

        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={VIEWPORT}
          className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-end"
        >
          <motion.div variants={fadeUp} className="lg:col-span-6">
            <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold leading-tight text-foreground text-balance">
              {t("landing.trustHeading")}
            </h2>
          </motion.div>
          <motion.div variants={fadeUp} className="lg:col-span-6">
            <p className="text-sm sm:text-base text-foreground/60 leading-relaxed">
              {t("landing.trustSubheading")}
            </p>
          </motion.div>
        </motion.div>

        {/* Seluruh carousel muncul sebagai satu kesatuan (Opsi C) */}
        <div className="mt-10 relative scroll-reveal-card" ref={revealRef}>
          {/* Slider Container */}
          <div
            id="testimonial-slider"
            className="flex overflow-x-auto snap-x snap-mandatory gap-5 pb-8 pt-2 no-scrollbar"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {items.map((it) => (
              <article
                key={it.name}
                className="w-full md:w-[calc(50%-10px)] lg:w-[calc(33.333%-13.4px)] shrink-0 snap-center rounded-3xl bg-white p-6 lg:p-8 border border-border/50 shadow-sm transition-all hover:shadow-md h-auto flex flex-col"
              >
                <div className="flex items-center gap-4 mb-5">
                  <div className="relative h-20 w-20 min-h-[80px] min-w-[80px] shrink-0 overflow-hidden rounded-full bg-neutral-100 ring-4 ring-leaf/20">
                    <Image src={it.img} alt={it.name} fill sizes="80px" className="object-cover" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{it.name}</p>
                    <p className="text-xs text-foreground/50">{it.role}</p>
                  </div>
                </div>
                <p className="text-sm lg:text-base text-foreground/80 leading-relaxed">&ldquo;{it.quote}&rdquo;</p>
              </article>
            ))}
          </div>

          {/* Tombol Panah (di pojok kanan bawah seperti permintaan/coretan user) */}
          <div className="flex justify-end gap-3 mt-2 pr-2">
            <button
              onClick={() => {
                const el = document.getElementById("testimonial-slider")
                if (el) el.scrollBy({ left: -el.clientWidth, behavior: "smooth" })
              }}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-md border border-border/50 text-foreground transition-all hover:bg-leaf hover:text-primary-deepest hover:scale-105 active:scale-95"
              aria-label="Previous Testimonial"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              onClick={() => {
                const el = document.getElementById("testimonial-slider")
                if (el) el.scrollBy({ left: el.clientWidth, behavior: "smooth" })
              }}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-md border border-border/50 text-foreground transition-all hover:bg-leaf hover:text-primary-deepest hover:scale-105 active:scale-95"
              aria-label="Next Testimonial"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </div>
        </div>

      </div>
    </section>
  )
}

/* ──────────── FAQ ──────────── */
function FaqSection({ t }: { t: TFn }) {
  const revealRef = useScrollReveal()

  const items = [
    { q: t("landing.faq1Q"), a: t("landing.faq1A") },
    { q: t("landing.faq2Q"), a: t("landing.faq2A") },
    { q: t("landing.faq3Q"), a: t("landing.faq3A") },
    { q: t("landing.faq4Q"), a: t("landing.faq4A") },
    { q: t("landing.faq5Q"), a: t("landing.faq5A") },
  ]
  const [openIdx, setOpenIdx] = useState<number | null>(0)

  return (
    <section id="faq" className="py-12 lg:py-20 px-5 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <SectionEyebrow label={t("landing.faqEyebrow")} />

        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={VIEWPORT}
          className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-end"
        >
          <motion.div variants={fadeUp} className="lg:col-span-6">
            <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold leading-tight text-foreground text-balance">
              {t("landing.faqHeading")}
            </h2>
          </motion.div>
          <motion.div variants={fadeUp} className="lg:col-span-6">
            <p className="text-sm sm:text-base text-foreground/60 leading-relaxed">
              {t("landing.faqSubheading")}
            </p>
          </motion.div>
        </motion.div>

        <div className="mt-10 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-start">
          <motion.div
            variants={fadeLeft}
            initial="hidden"
            whileInView="show"
            viewport={VIEWPORT}
            className="lg:col-span-5"
          >
            <div className="relative h-64 lg:h-[420px] overflow-hidden rounded-3xl shadow-[0_20px_50px_-20px_rgba(0,108,73,0.3)]">
              <Image src={IMG.faq} alt="Farm field" fill sizes="(max-width: 1024px) 100vw, 500px" className="object-cover" />
            </div>
          </motion.div>

          <div
            className="lg:col-span-7 space-y-3"
          >
            {items.map((it, i) => {
              const isOpen = openIdx === i
              return (
                <div
                  key={i}
                  ref={revealRef}
                  className={cn(
                    "scroll-reveal-card rounded-2xl border bg-white overflow-hidden",
                    isOpen ? "border-leaf/60 shadow-md" : "border-border/50 hover:border-leaf/40",
                  )}
                  style={{ "--reveal-delay": `${i * 120}ms` } as React.CSSProperties}
                >
                  <button
                    type="button"
                    onClick={() => setOpenIdx(isOpen ? null : i)}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                    aria-expanded={isOpen}
                  >
                    <span className="text-sm sm:text-base font-medium text-foreground">{it.q}</span>
                    <span
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all duration-300",
                        isOpen ? "bg-leaf text-primary-deepest rotate-45" : "bg-surface-sage text-foreground",
                      )}
                    >
                      <Plus className="h-4 w-4" />
                    </span>
                  </button>
                  <div
                    className={cn(
                      "grid transition-[grid-template-rows] duration-300 ease-in-out",
                      isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                    )}
                  >
                    <div className="overflow-hidden">
                      <p className="px-5 pb-5 text-sm text-foreground/70 leading-relaxed">{it.a}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}


/* ──────────── Footer ──────────── */
function Footer({ t }: { t: TFn }) {
  return (
    <footer id="footer" className="bg-primary-deepest text-white">
      <div className="mx-auto max-w-7xl px-5 lg:px-10 py-12 lg:py-16">
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.1 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10"
        >
          {/* Brand + tagline */}
          <motion.div variants={fadeUp} className="space-y-4">
            <div className="flex items-center gap-2.5">
              <Image src="/favicon.png" alt="Hanjeli Logo" width={36} height={36} className="h-9 w-9 rounded-xl object-cover" />
              <span className="text-lg font-bold tracking-tight">{t("landing.footerBrand")}</span>
            </div>
            <p className="text-sm text-white/60 leading-relaxed">{t("landing.footerTagline")}</p>
          </motion.div>

          {/* Quick Links */}
          <motion.div variants={fadeUp}>
            <h4 className="text-sm font-semibold mb-4">{t("landing.footerQuickLinks")}</h4>
            <ul className="space-y-2.5 text-sm text-white/60">
              <li><a href="#hero" className="hover:text-leaf transition-colors">{t("landing.navHome")}</a></li>
              <li><a href="#about" className="hover:text-leaf transition-colors">{t("landing.navAbout")}</a></li>
              <li><a href="#service" className="hover:text-leaf transition-colors">{t("landing.navInnovation")}</a></li>
              <li><a href="#trust" className="hover:text-leaf transition-colors">{t("landing.navTestimonial")}</a></li>
              <li><a href="#faq" className="hover:text-leaf transition-colors">{t("landing.navFaq")}</a></li>
            </ul>
          </motion.div>

          {/* Owner Contact (Hanjeli) */}
          <motion.div variants={fadeUp}>
            <h4 className="text-sm font-semibold mb-4">{t("landing.footerContact")}</h4>
            <ul className="space-y-3 text-sm text-white/65">
              <li>
                <a
                  href={`mailto:${t("landing.footerEmail")}`}
                  className="inline-flex items-center gap-2 hover:text-leaf transition-colors break-all"
                >
                  <Mail className="h-4 w-4 shrink-0" />
                  {t("landing.footerEmail")}
                </a>
              </li>
              <li>
                <a
                  href={`tel:${t("landing.footerPhoneTel")}`}
                  className="inline-flex items-center gap-2 hover:text-leaf transition-colors"
                >
                  <Phone className="h-4 w-4 shrink-0" />
                  {t("landing.footerPhone")}
                </a>
              </li>
              <li>
                <a
                  href="https://maps.app.goo.gl/QaaddwBWv3veKyzi8"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-2 leading-relaxed hover:text-leaf transition-colors"
                >
                  <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{t("landing.footerAddressValue")}</span>
                </a>
              </li>
            </ul>
          </motion.div>

          {/* Developer / Social */}
          <motion.div variants={fadeUp}>
            <h4 className="text-sm font-semibold mb-4">{t("landing.devTitle")}</h4>
            <ul className="space-y-3 text-sm text-white/65">
              <li>
                <a
                  href={`mailto:${t("landing.devEmail")}`}
                  className="inline-flex items-center gap-2 hover:text-leaf transition-colors break-all"
                >
                  <Mail className="h-4 w-4 shrink-0" />
                  {t("landing.devEmail")}
                </a>
              </li>
              <li>
                <a
                  href={`tel:${t("landing.devPhoneTel")}`}
                  className="inline-flex items-center gap-2 hover:text-leaf transition-colors"
                >
                  <Phone className="h-4 w-4 shrink-0" />
                  {t("landing.devPhone")}
                </a>
              </li>
              <li>
                <a
                  href="https://maps.app.goo.gl/9v8E89EaXLGjRWLR8"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-2 leading-relaxed hover:text-leaf transition-colors"
                >
                  <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{t("landing.devAddressValue")}</span>
                </a>
              </li>
              <li>
                <a
                  href="https://linkedin.com/company/coe-stas-rg/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-start gap-2 hover:text-leaf transition-colors"
                >
                  <Linkedin className="h-4 w-4 shrink-0 mt-0.5" />
                  {t("landing.devLinkedIn")}
                </a>
              </li>
              <li>
                <a
                  href="https://instagram.com/stas.rg"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 hover:text-leaf transition-colors"
                >
                  <Instagram className="h-4 w-4 shrink-0" />
                  {t("landing.devInstagram")}
                </a>
              </li>
            </ul>
          </motion.div>
        </motion.div>

        <div className="mt-12 h-px bg-white/10" />

        {/* Copyright row */}
        <div className="mt-10 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-white/40">
          <p>{t("landing.footerCopyright", { year: new Date().getFullYear() })}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 justify-center">
            <Link href="/privacy" className="hover:text-leaf transition-colors">{t("landing.footerPrivacy")}</Link>
            <Link href="/terms" className="hover:text-leaf transition-colors">{t("landing.footerTerms")}</Link>
            <Link href="/cookies" className="hover:text-leaf transition-colors">{t("landing.footerCookies")}</Link>
          </div>
          <p>{t("landing.footerMadeBy")}</p>
        </div>
      </div>
    </footer>
  )
}

/* ──────────── Shared ──────────── */
function SectionEyebrow({ label }: { label: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.5 }}
      transition={{ duration: 0.5, ease: EASE }}
      className="flex items-center gap-2 text-leaf-strong"
    >
      <ChevronDown className="h-4 w-4 animate-bounce" />
      <span className="text-xs font-semibold uppercase tracking-[0.18em]">{label}</span>
    </motion.div>
  )
}
