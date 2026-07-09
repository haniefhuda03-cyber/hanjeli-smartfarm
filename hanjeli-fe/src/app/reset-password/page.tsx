"use client"

import { useState, useEffect, Suspense } from "react"
import { useTranslation } from "react-i18next"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Lock, CheckCircle2, ShieldCheck, Clock, XCircle, Loader2, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { NeuInput } from "@/components/ui/neu-input"
import { useMutation } from "@tanstack/react-query"
import { authApi } from "@/lib/api/auth"
import {
  AUTH_IMG,
  AuthVisual,
  BrandMark,
  ErrorBanner,
  FieldGroup,
  FieldLabel,
  PasswordToggle,
  authInputClass,
  AuthLoadingFallback,
} from "@/lib/auth-shared"
import { PasswordStrength } from "@/components/ui/password-strength"
import { isPasswordStrong } from "@/lib/password"
import { getApiErrorMessage } from "@/lib/api/errors"
import {
  clearAuthSession,
  clearResetPasswordIntent,
  clearResetPasswordToken,
  getResetPasswordToken,
} from "@/lib/auth-session"

function ResetPasswordForm() {
  const { t } = useTranslation()
  const searchParams = useSearchParams()
  // Token utamanya dibawa lewat sessionStorage (dari /auth/callback) agar
  // tidak tampil di address bar; query string hanya fallback tautan lama.
  // Dibaca di effect (bukan saat render) supaya SSR/hydration konsisten.
  const [token, setToken] = useState<string | null>(null)
  const [tokenReady, setTokenReady] = useState(false)

  useEffect(() => {
    setToken(getResetPasswordToken() ?? searchParams.get("token"))
    setTokenReady(true)
  }, [searchParams])

  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [error, setError] = useState("")

  const isTokenExpired = token === "expired"
  const isTokenInvalid = tokenReady && !token

  const resetMutation = useMutation({
    mutationFn: authApi.resetPassword,
    onSuccess: () => {
      setIsSubmitted(true)
      clearResetPasswordIntent()
      clearResetPasswordToken()
      /* Backend menginvalidasi SEMUA sesi saat password direset — bersihkan
         sesi lokal juga agar tidak ada state login basi yang memantul-mantul. */
      clearAuthSession()
    },
    onError: (err: unknown) => {
      setError(getApiErrorMessage(err, t("auth.resetFailed", "Gagal mereset password. Silakan minta link baru.")))
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!isPasswordStrong(newPassword)) {
      setError(t("auth.passwordPolicyError"))
      return
    }
    if (newPassword !== confirmPassword) {
      setError(t("auth.passwordMismatch"))
      return
    }

    resetMutation.mutate({
      token,
      new_password: newPassword,
    })
  }

  const isLoading = resetMutation.isPending

  const renderErrorState = (title: string, description: string, icon: React.ReactNode) => (
    <div className="text-center lg:text-left">
      <div className="mb-4 mx-auto lg:mx-0 flex h-14 w-14 items-center justify-center rounded-2xl bg-error-container">
        {icon}
      </div>
      <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-foreground/60 leading-relaxed max-w-sm mx-auto lg:mx-0">{description}</p>
      <div className="mt-6 space-y-3">
        <Link href="/forgot-password" className="block">
          <Button className="w-full h-12 rounded-full bg-leaf text-primary-deepest text-sm font-semibold hover:bg-leaf-strong hover:shadow-lg hover:shadow-leaf/30 transition-all">
            {t("auth.requestNewLink")}
          </Button>
        </Link>
        <Link href="/login" className="block">
          <Button className="w-full h-12 rounded-full bg-white border border-border/70 text-sm font-semibold text-foreground hover:border-leaf-strong hover:bg-surface-sage/30 transition-all">
            {t("auth.backToLogin")}
          </Button>
        </Link>
      </div>
    </div>
  )

  const renderForm = () => (
    <>
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-leaf/30">
        <ShieldCheck className="h-6 w-6 text-primary-deepest" />
      </div>
      <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
        {t("auth.resetYourPassword")}
      </h1>
      <p className="mt-1.5 text-sm text-foreground/60">{t("auth.enterNewPasswordDesc")}</p>

      <div className="mt-3 flex items-center gap-2 rounded-xl bg-surface-sage-soft px-3 py-1.5">
        <Clock className="h-3.5 w-3.5 text-foreground/50 shrink-0" />
        <p className="text-xs text-foreground/60">{t("auth.resetLinkValid")}</p>
      </div>

      <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
        <FieldLabel>{t("auth.newPassword")}</FieldLabel>
        <FieldGroup>
          <Lock className="absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-foreground/40" />
          <NeuInput
            type={showNewPassword ? "text" : "password"}
            placeholder={t("auth.enterNewPassword")}
            value={newPassword}
            onChange={(e) => { setNewPassword(e.target.value); setError("") }}
            variant="flat"
            className={authInputClass({ withRight: true })}
          />
          <PasswordToggle show={showNewPassword} onToggleAction={() => setShowNewPassword(!showNewPassword)} t={t} />
        </FieldGroup>

        <FieldLabel>{t("auth.confirmPassword")}</FieldLabel>
        <FieldGroup>
          <Lock className="absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-foreground/40" />
          <NeuInput
            type={showConfirmPassword ? "text" : "password"}
            placeholder={t("auth.confirmYourPassword")}
            value={confirmPassword}
            onChange={(e) => { setConfirmPassword(e.target.value); setError("") }}
            variant="flat"
            className={authInputClass({ withRight: true })}
          />
          <PasswordToggle show={showConfirmPassword} onToggleAction={() => setShowConfirmPassword(!showConfirmPassword)} t={t} />
        </FieldGroup>

        {error && <ErrorBanner>{error}</ErrorBanner>}

        <PasswordStrength password={newPassword} confirmPassword={confirmPassword} t={t} />

        <Button
          type="submit"
          disabled={isLoading || !newPassword || !confirmPassword}
          className="w-full h-12 rounded-full bg-leaf text-primary-deepest text-sm font-semibold hover:bg-leaf-strong hover:shadow-lg hover:shadow-leaf/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          {isLoading ? t("auth.saving") : t("auth.resetPassword")}
          {!isLoading && <ArrowRight className="h-4 w-4" />}
        </Button>
      </form>
    </>
  )

  const renderSuccess = () => (
    <div className="text-center lg:text-left">
      <div className="mb-4 mx-auto lg:mx-0 flex h-14 w-14 items-center justify-center rounded-2xl bg-leaf">
        <CheckCircle2 className="h-7 w-7 text-primary-deepest" />
      </div>
      <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
        {t("auth.resetSuccess")}
      </h1>
      <p className="mt-2 text-sm text-foreground/60 leading-relaxed max-w-sm mx-auto lg:mx-0">
        {t("auth.resetSuccessDesc")}
      </p>
      <Link href="/login" className="block mt-6">
        <Button className="w-full h-12 rounded-full bg-leaf text-primary-deepest text-sm font-semibold hover:bg-leaf-strong hover:shadow-lg hover:shadow-leaf/30 transition-all flex items-center justify-center gap-2">
          {t("auth.signIn")}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </Link>
    </div>
  )

  const renderContent = () => {
    if (isTokenInvalid) {
      return renderErrorState(
        t("auth.linkInvalid"),
        t("auth.linkInvalidDesc"),
        <XCircle className="h-8 w-8 text-error" />,
      )
    }
    if (isTokenExpired) {
      return renderErrorState(
        t("auth.linkExpired"),
        t("auth.linkExpiredDesc"),
        <Clock className="h-8 w-8 text-error" />,
      )
    }
    if (isSubmitted) return renderSuccess()
    return renderForm()
  }

  return (
    <div className="min-h-screen w-full bg-surface-soft lg:flex lg:h-screen lg:overflow-hidden">
      <AuthVisual title={t("auth.createNewPassword")} desc={t("auth.createNewPasswordDesc")} imgSrc={AUTH_IMG.reset} />

      <div className="flex-1 flex flex-col lg:overflow-y-auto">
        <header className="lg:hidden flex items-center justify-center px-5 py-3 border-b border-border/50 bg-surface-soft">
          <BrandMark />
        </header>

        <div className="flex-1 flex items-center justify-center px-5 py-6 sm:px-8 lg:px-14 lg:py-4">
          <div className="w-full max-w-md">
            <div className="hidden lg:flex items-center justify-between mb-6">
              <BrandMark />
            </div>
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<AuthLoadingFallback />}>
      <ResetPasswordForm />
    </Suspense>
  )
}
