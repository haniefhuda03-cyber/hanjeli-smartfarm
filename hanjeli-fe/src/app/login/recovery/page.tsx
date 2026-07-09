"use client"

import { useState, Suspense } from "react"
import { useTranslation } from "react-i18next"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { KeyRound, ArrowLeft, AlertTriangle, Loader2, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AUTH_IMG, AuthVisual, BrandMark, ErrorBanner, FieldLabel, AuthLoadingFallback } from "@/lib/auth-shared"
import { apiClient } from "@/lib/api/client"
import { getApiErrorMessage } from "@/lib/api/errors"
import {
  clearChallengeToken,
  getChallengeToken,
  storeAuthSession,
  type AuthTokensResponse,
} from "@/lib/auth-session"

function RecoveryForm() {
  const router = useRouter()
  const { t } = useTranslation()

  const [recoveryCode, setRecoveryCode] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const handleFormatCode = (value: string) => {
    const cleaned = value.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 8)
    if (cleaned.length > 4) return cleaned.slice(0, 4) + "-" + cleaned.slice(4)
    return cleaned
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (recoveryCode.replace("-", "").length !== 8) {
      setError(t("auth.recoveryCodeError"))
      return
    }

    /* Challenge token hanya lewat sessionStorage — tidak pernah di URL */
    const challengeToken = getChallengeToken()
    if (!challengeToken) {
      setError(t("auth.sessionExpired", "Sesi verifikasi berakhir. Silakan login ulang."))
      return
    }

    setIsLoading(true)
    setError("")

    try {
      const session = await apiClient.post('/auth/verify-recovery', {
        challenge_token: challengeToken,
        code: recoveryCode,
      }) as AuthTokensResponse

      storeAuthSession(session)
      clearChallengeToken()
      router.push("/home")
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, t("auth.recoveryCodeInvalid")))
    } finally {
      setIsLoading(false)
    }
  }

  const back2faHref = "/login/verify-2fa"

  return (
    <div className="min-h-screen w-full bg-surface-soft lg:flex lg:h-screen lg:overflow-hidden">
      <AuthVisual title={t("auth.recoveryCode")} desc={t("auth.recoveryDesktopDesc")} imgSrc={AUTH_IMG.recovery} />

      <div className="flex-1 flex flex-col lg:overflow-y-auto">
        <header className="lg:hidden flex items-center justify-between px-5 py-3 border-b border-border/50 bg-surface-soft">
          <Link
            href={back2faHref}
            aria-label={t("auth.backTo2faDesktop")}
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
                href={back2faHref}
                aria-label={t("auth.backTo2faDesktop")}
                className="text-sm font-medium text-foreground/60 hover:text-primary inline-flex items-center gap-1.5"
              >
                <ArrowLeft className="h-4 w-4" />
                {t("auth.backTo2faDesktop")}
              </Link>
            </div>

            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-leaf/30">
              <KeyRound className="h-6 w-6 text-primary-deepest" />
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
              {t("auth.enterRecoveryCode")}
            </h1>
            <p className="mt-1.5 text-sm text-foreground/60">{t("auth.enterRecoveryCodeDesc")}</p>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <FieldLabel>{t("auth.recoveryCodeLabel")}</FieldLabel>
              <div className="-mt-3">
                <input
                  type="text"
                  value={recoveryCode}
                  onChange={(e) => { setRecoveryCode(handleFormatCode(e.target.value)); setError("") }}
                  placeholder="XXXX-XXXX"
                  className="h-12 w-full rounded-2xl border border-border/70 bg-white px-4 text-center text-lg font-mono font-bold tracking-[0.2em] text-foreground placeholder:text-foreground/30 placeholder:tracking-[0.2em] focus:outline-none focus:border-leaf-strong focus:ring-2 focus:ring-leaf-strong/20"
                />
              </div>

              {error && <ErrorBanner>{error}</ErrorBanner>}

              <div className="rounded-xl bg-surface-sage-soft p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-foreground/60 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-foreground/70 leading-snug">
                    {t("auth.recoveryCodeWarning")} <span className="font-semibold text-foreground">{t("auth.oneTime")}</span>{t("auth.recoveryCodeWarning2")}
                  </p>
                </div>
              </div>

              <Button
                type="submit"
                disabled={isLoading || recoveryCode.replace("-", "").length !== 8}
                className="w-full h-12 rounded-full bg-leaf text-primary-deepest text-sm font-semibold hover:bg-leaf-strong hover:shadow-lg hover:shadow-leaf/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                {isLoading ? t("auth.verifying") : t("auth.verifyCode")}
                {!isLoading && <ArrowRight className="h-4 w-4" />}
              </Button>

              <Button asChild type="button" className="w-full h-12 rounded-full bg-white border border-border/70 text-sm font-semibold text-foreground hover:border-leaf-strong hover:bg-surface-sage/30 transition-all">
                <Link href={back2faHref} className="flex items-center justify-center">
                  {t("auth.backTo2faDesktop")}
                </Link>
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function RecoveryPage() {
  return (
    <Suspense fallback={<AuthLoadingFallback />}>
      <RecoveryForm />
    </Suspense>
  )
}
