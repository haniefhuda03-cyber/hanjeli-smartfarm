"use client"

import { useState, useEffect, useMemo, Suspense } from "react"
import { useTranslation } from "react-i18next"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Shield, ArrowLeft, KeyRound, Loader2, RefreshCw, Clock, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { REGEXP_ONLY_DIGITS } from "input-otp"
import { useMutation } from "@tanstack/react-query"
import { authApi } from "@/lib/api/auth"
import { cn } from "@/lib/utils"
import { AUTH_IMG, AuthVisual, BrandMark, ErrorBanner, AuthLoadingFallback } from "@/lib/auth-shared"
import { getApiErrorMessage } from "@/lib/api/errors"
import {
  clearChallengeToken,
  getChallengeToken,
  storeAuthSession,
  type AuthTokensResponse,
} from "@/lib/auth-session"

const CODE_LIFETIME_SECONDS = 30
const RESEND_COOLDOWN_SECONDS = 30

function Verify2FAForm() {
  const router = useRouter()
  const { t } = useTranslation()

  const [code, setCode] = useState("")
  const [error, setError] = useState("")
  const [codeTimeLeft, setCodeTimeLeft] = useState(CODE_LIFETIME_SECONDS)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [resending, setResending] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => {
      setCodeTimeLeft((s) => (s <= 1 ? CODE_LIFETIME_SECONDS : s - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setInterval(() => setResendCooldown((s) => (s > 0 ? s - 1 : 0)), 1000)
    return () => clearInterval(timer)
  }, [resendCooldown])

  const verifyMutation = useMutation({
    mutationFn: authApi.verify2Fa,
    onSuccess: (session: AuthTokensResponse) => {
      storeAuthSession(session)
      clearChallengeToken()
      router.push("/home")
    },
    onError: (err: unknown) => {
      setError(getApiErrorMessage(err, t("auth.invalidCode")))
      setCode("")
    }
  })

  const handleVerify = () => {
    if (code.length !== 6) return
    /* Challenge token hanya lewat sessionStorage — tidak pernah di URL */
    const challengeToken = getChallengeToken()

    if (!challengeToken) {
      setError(t("auth.sessionExpired", "Sesi verifikasi berakhir. Silakan login ulang."))
      return
    }

    setError("")
    verifyMutation.mutate({
      challenge_token: challengeToken,
      token: code,
    })
  }

  const isLoading = verifyMutation.isPending

  const handleResend = async () => {
    if (resendCooldown > 0 || resending) return
    setResending(true)
    setError("")
    await new Promise(resolve => setTimeout(resolve, 250))
    setResending(false)
    setResendCooldown(RESEND_COOLDOWN_SECONDS)
    setCodeTimeLeft(CODE_LIFETIME_SECONDS)
  }

  const otpSlotClass = useMemo(() => cn(
    "h-14 w-12 rounded-2xl border bg-white text-xl font-bold text-foreground outline-none transition-all",
    "data-[active=true]:border-leaf-strong data-[active=true]:ring-2 data-[active=true]:ring-leaf-strong/20 data-[active=true]:z-10",
    error
      ? "border-error/50 bg-error-container/30"
      : "border-border/70",
  ), [error])

  return (
    <div className="min-h-screen w-full bg-surface-soft lg:flex lg:h-screen lg:overflow-hidden">
      <AuthVisual title={t("auth.verify2faDesktop")} desc={t("auth.verify2faDesktopDesc")} imgSrc={AUTH_IMG.verify2fa} />

      <div className="flex-1 flex flex-col lg:overflow-y-auto">
        <header className="lg:hidden flex items-center justify-between px-5 py-3 border-b border-border/50 bg-surface-soft">
          <Link
            href="/login"
            aria-label={t("auth.back")}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white border border-border/60 transition hover:bg-leaf hover:border-leaf"
          >
            <ArrowLeft className="h-4 w-4 text-primary-deepest" />
          </Link>
          <BrandMark />
        </header>

        <div className="flex-1 flex items-center justify-center px-5 py-6 sm:px-8 lg:px-14 lg:py-4">
          <div className="w-full max-w-md">
            <div className="hidden lg:flex items-center justify-between mb-6">
              <BrandMark />
              <Link
                href="/login"
                aria-label={t("auth.back")}
                className="text-sm font-medium text-foreground/60 hover:text-primary inline-flex items-center gap-1.5"
              >
                <ArrowLeft className="h-4 w-4" />
                {t("auth.back")}
              </Link>
            </div>

            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-leaf/30">
              <Shield className="h-6 w-6 text-primary-deepest" />
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
              {t("auth.enter2faCode")}
            </h1>
            <p className="mt-1.5 text-sm text-foreground/60">{t("auth.enter2faCodeDesc")}</p>

            <div className="mt-6 space-y-4">
              <div className="flex justify-center">
                <InputOTP
                  maxLength={6}
                  value={code}
                  pattern={REGEXP_ONLY_DIGITS}
                  inputMode="numeric"
                  onChange={(value) => { setCode(value); setError("") }}
                  aria-label={t("auth.enter2faCode")}
                  containerClassName="gap-2"
                >
                  <InputOTPGroup className="gap-2">
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <InputOTPSlot key={i} index={i} className={otpSlotClass} />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>

              <div className="flex items-center justify-center gap-1.5 text-xs text-foreground/60" role="timer" aria-live="polite">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{t("auth.codeExpiresIn", { seconds: codeTimeLeft, defaultValue: "Kode aktif {{seconds}}s" })}</span>
              </div>

              {error && <ErrorBanner>{error}</ErrorBanner>}

              <Button
                onClick={handleVerify}
                disabled={code.length !== 6 || isLoading}
                className="w-full h-12 rounded-full bg-leaf text-primary-deepest text-sm font-semibold hover:bg-leaf-strong hover:shadow-lg hover:shadow-leaf/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                {isLoading ? t("auth.verifying") : t("auth.verify")}
                {!isLoading && <ArrowRight className="h-4 w-4" />}
              </Button>

              <button
                type="button"
                onClick={handleResend}
                disabled={resendCooldown > 0 || resending}
                className="w-full text-center text-sm font-medium text-foreground/70 hover:text-leaf-strong disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 transition-colors"
              >
                {resending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                {resendCooldown > 0
                  ? t("auth.resendCodeIn", { seconds: resendCooldown, defaultValue: "Kirim ulang dalam {{seconds}}s" })
                  : t("auth.tryNextCode", "Coba kode berikutnya")}
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border/60" /></div>
                <div className="relative flex justify-center"><span className="bg-surface-soft px-3 text-xs text-foreground/50">{t("auth.or")}</span></div>
              </div>

              <Button asChild className="w-full h-12 rounded-full bg-white border border-border/70 text-sm font-semibold text-foreground hover:border-leaf-strong hover:bg-surface-sage/30 transition-all">
                <Link href="/login/recovery" className="flex items-center justify-center gap-2">
                  <KeyRound className="h-4 w-4" />
                  {t("auth.useRecoveryCode")}
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Verify2FAPage() {
  return (
    <Suspense fallback={<AuthLoadingFallback />}>
      <Verify2FAForm />
    </Suspense>
  )
}
