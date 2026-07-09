"use client"

import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import Link from "next/link"
import { Mail, ArrowLeft, ArrowRight, CheckCircle2, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useMutation } from "@tanstack/react-query"
import { authApi } from "@/lib/api/auth"
import {
  AUTH_IMG,
  AuthVisual,
  BrandMark,
  ErrorBanner,
  FieldGroup,
  FieldLabel,
  authInputClass,
} from "@/lib/auth-shared"
import { getApiErrorMessage } from "@/lib/api/errors"

const RESEND_COOLDOWN_SECONDS = 60

function maskEmail(email: string) {
  const [local, domain] = email.split("@")
  if (!local || !domain) return email
  if (local.length <= 2) return `${local[0] ?? ""}***@${domain}`
  const visible = local.slice(0, Math.min(4, local.length - 2))
  return `${visible}${"*".repeat(Math.max(3, local.length - visible.length))}@${domain}`
}

export default function ForgotPasswordPage() {
  const { t } = useTranslation()
  const [email, setEmail] = useState("")
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [error, setError] = useState("")

  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setInterval(() => setResendCooldown((s) => (s > 0 ? s - 1 : 0)), 1000)
    return () => clearInterval(timer)
  }, [resendCooldown])

  const forgotMutation = useMutation({
    mutationFn: authApi.forgotPassword,
    onSuccess: () => {
      setIsSubmitted(true)
      setResendCooldown(RESEND_COOLDOWN_SECONDS)
    },
    onError: (err: unknown) => {
      setError(getApiErrorMessage(err, t("auth.resetRequestFailed", "Gagal mengirim link reset password.")))
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!email) {
      setError(t("auth.emailRequired"))
      return
    }

    forgotMutation.mutate({ email })
  }

  const handleResend = () => {
    if (resendCooldown > 0 || forgotMutation.isPending) return
    setError("")
    forgotMutation.mutate({ email })
  }

  const isLoading = forgotMutation.isPending

  const maskedEmail = maskEmail(email)

  return (
    <div className="min-h-screen w-full bg-surface-soft lg:flex lg:h-screen lg:overflow-hidden">
      <AuthVisual
        title={t("auth.resetYourPassword")}
        desc={t("auth.resetDesktopDesc")}
        imgSrc={AUTH_IMG.forgot}
      />

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
                {t("auth.backToLogin")}
              </Link>
            </div>

            {!isSubmitted ? (
              <>
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-leaf/30">
                  <Mail className="h-6 w-6 text-primary-deepest" />
                </div>
                <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
                  {t("auth.forgotPasswordTitle")}
                </h1>
                <p className="mt-1.5 text-sm text-foreground/60">{t("auth.forgotPasswordDesktopDesc")}</p>

                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                  <FieldLabel>{t("auth.emailAddress")}</FieldLabel>
                  <FieldGroup>
                    <Mail className="absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-foreground/40" />
                    <Input
                      type="email"
                      placeholder={t("auth.enterEmail")}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={authInputClass()}
                    />
                  </FieldGroup>

                  {error && <ErrorBanner>{error}</ErrorBanner>}

                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-12 rounded-full bg-leaf text-primary-deepest text-sm font-semibold hover:bg-leaf-strong hover:shadow-lg hover:shadow-leaf/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                    {isLoading ? t("auth.sending") : t("auth.sendResetLink")}
                    {!isLoading && <ArrowRight className="h-4 w-4" />}
                  </Button>
                </form>

                <p className="text-center text-sm text-foreground/60 mt-5">
                  {t("auth.rememberPassword")}
                  <Link href="/login" className="font-semibold text-primary-deepest hover:text-leaf-strong">
                    {t("auth.signIn")}
                  </Link>
                </p>
              </>
            ) : (
              <div className="text-center lg:text-left">
                <div className="mb-4 mx-auto lg:mx-0 flex h-14 w-14 items-center justify-center rounded-2xl bg-leaf">
                  <CheckCircle2 className="h-7 w-7 text-primary-deepest" />
                </div>

                <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
                  {t("auth.checkYourEmail")}
                </h1>
                <p className="mt-2 text-sm text-foreground/60 leading-relaxed">
                  {t("auth.resetLinkSent")}
                  <span className="font-semibold text-foreground">{maskedEmail}</span>
                </p>

                <div className="mt-6 space-y-3">
                  {error && <ErrorBanner>{error}</ErrorBanner>}

                  <Button
                    onClick={handleResend}
                    disabled={resendCooldown > 0 || isLoading}
                    className="w-full h-12 rounded-full bg-white border border-border/70 text-sm font-semibold text-foreground hover:border-leaf-strong hover:bg-surface-sage/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    {resendCooldown > 0 ? t("auth.resendIn", { seconds: resendCooldown }) : t("auth.resendEmail")}
                  </Button>

                  <Link href="/login" className="block">
                    <Button className="w-full h-12 rounded-full bg-leaf text-primary-deepest text-sm font-semibold hover:bg-leaf-strong hover:shadow-lg hover:shadow-leaf/30 transition-all">
                      {t("auth.backToLogin")}
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
