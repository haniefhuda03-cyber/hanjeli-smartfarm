"use client"

import { useState, useEffect, Suspense } from "react"
import { useTranslation } from "react-i18next"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import { Mail, CheckCircle2, RefreshCw, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useMutation } from "@tanstack/react-query"
import { authApi } from "@/lib/api/auth"
import { AUTH_IMG, AuthVisual, BrandMark, AuthLoadingFallback, ErrorBanner } from "@/lib/auth-shared"
import { getApiErrorMessage } from "@/lib/api/errors"
import { getVerifyEmailIntent, clearVerifyEmailIntent } from "@/lib/auth-session"

function VerifyEmailForm() {
  const { t } = useTranslation()
  const router = useRouter()
  const searchParams = useSearchParams()
  const email = getVerifyEmailIntent() || searchParams.get("email") || ""
  const token = searchParams.get("token")

  const [resendCooldown, setResendCooldown] = useState(0)
  const [resendCount, setResendCount] = useState(0)
  const [verified, setVerified] = useState(false)
  const [error, setError] = useState("")

  const verifyMutation = useMutation({
    mutationFn: authApi.verifyEmail,
    onSuccess: () => {
      setVerified(true)
      clearVerifyEmailIntent()
    },
    onError: (err: unknown) => {
      setError(getApiErrorMessage(err, t("auth.linkInvalidDesc")))
    }
  })

  useEffect(() => {
    if (!token || verified) return
    verifyMutation.mutate({ token })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  useEffect(() => {
    if (!verified) return
    const id = setTimeout(() => router.push("/login"), 1500)
    return () => clearTimeout(id)
  }, [verified, router])

  const startCooldown = () => {
    setResendCooldown(60)
    const interval = setInterval(() => {
      setResendCooldown(prev => {
        if (prev <= 1) { clearInterval(interval); return 0 }
        return prev - 1
      })
    }, 1000)
  }

  const resendMutation = useMutation({
    mutationFn: authApi.resendVerification,
    onSuccess: () => {
      setResendCount(prev => prev + 1)
      startCooldown()
    },
    onError: (err: unknown) => {
      setError(getApiErrorMessage(err, t("auth.resendVerificationFailed", "Gagal mengirim ulang email verifikasi.")))
    }
  })

  const handleResend = () => {
    if (resendCooldown > 0 || resendMutation.isPending) return
    setError("")
    resendMutation.mutate({ email })
  }

  const isVerifying = verifyMutation.isPending
  const isResending = resendMutation.isPending

  return (
    <div className="min-h-screen w-full bg-surface-soft lg:flex lg:h-screen lg:overflow-hidden">
      <AuthVisual title={t("auth.oneMoreStep")} desc={t("auth.oneMoreStepDesc")} imgSrc={AUTH_IMG.verifyEmail} />

      <div className="flex-1 flex flex-col lg:overflow-y-auto">
        <header className="lg:hidden flex items-center justify-center px-5 py-3 border-b border-border/50 bg-surface-soft">
          <BrandMark />
        </header>

        <div className="flex-1 flex items-center justify-center px-5 py-6 sm:px-8 lg:px-14 lg:py-4">
          <div className="w-full max-w-md">
            <div className="hidden lg:flex items-center justify-between mb-5">
              <BrandMark />
            </div>

            <div className="text-center lg:text-left">
              <div className="relative inline-block mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-leaf/30">
                  <Mail className="h-6 w-6 text-primary-deepest" />
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-leaf-strong ring-4 ring-surface-soft">
                  <CheckCircle2 className="h-3 w-3 text-white" />
                </div>
              </div>

              <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
                {t("auth.checkEmail")}
              </h1>
              <p className="mt-2 text-sm text-foreground/60">{t("auth.verifyEmailSent")}</p>
              <p className="font-semibold text-foreground text-sm mt-0.5 break-all">{email}</p>
              <Link
                href="/register"
                className="inline-block text-xs font-medium text-foreground/50 hover:text-primary-deepest hover:underline mt-0.5"
              >
                {t("auth.wrongEmail", "Salah email? Daftar ulang")}
              </Link>

              <div className="flex items-center justify-center lg:justify-start gap-1.5 text-xs text-foreground/50 pt-1.5" aria-live="polite">
                {verified ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 text-leaf-strong" />
                    <span className="text-leaf-strong font-medium">
                      {t("auth.emailVerified", "Email berhasil diverifikasi, mengalihkan...")}
                    </span>
                  </>
                ) : isVerifying ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>{t("auth.checkingVerification", "Memeriksa status verifikasi...")}</span>
                  </>
                ) : (
                  <span>{t("auth.waitingVerification", "Buka tautan verifikasi dari email Anda.")}</span>
                )}
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {error && <ErrorBanner>{error}</ErrorBanner>}

              {/* Compact 3-step row: number badges aligned horizontally */}
              <div className="rounded-2xl bg-white border border-border/50 p-3 space-y-1.5">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="flex items-center gap-2.5">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-leaf text-primary-deepest text-[11px] font-bold">
                      {n}
                    </div>
                    <p className="text-xs text-foreground/75 leading-snug">
                      {t(`auth.verifyStep${n}`)}
                    </p>
                  </div>
                ))}
              </div>

              <div className="rounded-xl bg-warning/10 border border-warning/30 px-3 py-2">
                <p className="text-[11px] text-warning-foreground leading-snug">
                  <span className="font-semibold">{t("auth.emailNotFound")}</span> {t("auth.checkSpamShort")}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <Button
                  onClick={handleResend}
                  disabled={isResending || resendCooldown > 0}
                  className="h-11 rounded-full bg-white border border-border/70 text-sm font-semibold text-foreground hover:border-leaf-strong hover:bg-surface-sage/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <RefreshCw className={`h-4 w-4 ${isResending ? "animate-spin" : ""}`} />
                  {isResending
                    ? t("auth.resending")
                    : resendCooldown > 0
                      ? `${resendCooldown}s`
                      : t("auth.resendVerification")}
                </Button>

                <Link href="/login" className="block">
                  <Button className="w-full h-11 rounded-full bg-leaf text-primary-deepest text-sm font-semibold hover:bg-leaf-strong hover:shadow-lg hover:shadow-leaf/30 transition-all">
                    {t("auth.backToLogin")}
                  </Button>
                </Link>
              </div>

              {resendCount > 0 && (
                <p className="text-center text-[11px] text-foreground/50">
                  {t("auth.emailResent", { count: resendCount })}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<AuthLoadingFallback />}>
      <VerifyEmailForm />
    </Suspense>
  )
}
