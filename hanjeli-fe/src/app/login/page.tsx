"use client"

import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Mail, Lock, ArrowLeft, Loader2, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useMutation } from "@tanstack/react-query"
import { authApi, type LoginResponse } from "@/lib/api/auth"
import {
  AuthVisual,
  BrandMark,
  Divider,
  ErrorBanner,
  FieldGroup,
  FieldLabel,
  GoogleButton,
  PasswordToggle,
  authInputClass,
} from "@/lib/auth-shared"
import { getApiErrorMessage } from "@/lib/api/errors"
import { markForgotPasswordIntent, storeAuthSession, storeChallengeToken, type AuthTokensResponse } from "@/lib/auth-session"

export default function LoginPage() {
  const router = useRouter()
  const { t } = useTranslation()
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  // Explain why the user landed here when RouteGuard/proxy ejected them, so the
  // redirect (bugs #2 / #4) is never silent. Read from the URL directly to avoid
  // a useSearchParams Suspense boundary.
  useEffect(() => {
    const reason = new URLSearchParams(window.location.search).get("reason")
    if (!reason) return
    const messages: Record<string, string> = {
      idle: t("auth.sessionIdle", "Sesi berakhir karena tidak ada aktivitas. Silakan masuk kembali."),
      expired: t("auth.sessionExpiredNotice", "Sesi Anda telah berakhir. Silakan masuk kembali."),
      unauthenticated: t("auth.loginRequired", "Silakan masuk untuk mengakses halaman tersebut."),
    }
    const message = messages[reason]
    // One-shot read of the redirect reason from the URL on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (message) setNotice(message)
    // Strip the query so a refresh doesn't keep showing the banner.
    window.history.replaceState(null, "", window.location.pathname)
  }, [t])

  const loginMutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: (data: LoginResponse) => {
      if ("requires_2fa" in data && data.requires_2fa) {
        /* Challenge token & email tidak dibawa lewat URL — cukup sessionStorage */
        storeChallengeToken(data.challenge_token)
        router.push("/login/verify-2fa");
        return;
      }
      storeAuthSession(data as AuthTokensResponse)
      router.push("/home");
    },
    onError: (err: unknown) => {
      setError(getApiErrorMessage(err, t('auth.invalidCredentials')));
    }
  })

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!email) { setError(t('auth.emailRequired')); return }
    if (!password) { setError(t('auth.passwordRequired')); return }

    loginMutation.mutate({ email, password })
  }

  const isLoading = loginMutation.isPending

  return (
    <div className="min-h-screen w-full bg-surface-soft lg:flex lg:h-screen lg:overflow-hidden">
      {/* Visual side (image + brand) */}
      <AuthVisual />

      {/* Form side */}
      <div className="flex-1 flex flex-col lg:overflow-y-auto">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center justify-between px-5 py-3 border-b border-border/50 bg-surface-soft">
          <Link
            href="/"
            aria-label={t('auth.back')}
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
                href="/"
                aria-label={t('auth.back')}
                className="text-sm font-medium text-foreground/60 hover:text-primary inline-flex items-center gap-1.5"
              >
                <ArrowLeft className="h-4 w-4" />
                {t('auth.back')}
              </Link>
            </div>

            <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
              {t('auth.welcomeBack')}
            </h1>
            <p className="mt-1.5 text-sm text-foreground/60">{t('auth.signInCredentials')}</p>

            {notice && (
              <div
                className="mt-4 flex items-start gap-2 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3"
                role="status"
              >
                <p className="text-sm font-medium leading-snug text-warning-foreground">{notice}</p>
              </div>
            )}

            <form onSubmit={handleLogin} className="mt-6 space-y-4">
              <FieldLabel>{t('auth.email')}</FieldLabel>
              <FieldGroup>
                <Mail className="absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-foreground/40" />
                <Input
                  type="email"
                  placeholder={t('auth.enterEmail')}
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError("") }}
                  className={authInputClass()}
                />
              </FieldGroup>

              <FieldLabel>{t('auth.password')}</FieldLabel>
              <FieldGroup>
                <Lock className="absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-foreground/40" />
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder={t('auth.enterPassword')}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError("") }}
                  className={authInputClass({ withRight: true })}
                />
                <PasswordToggle
                  show={showPassword}
                  onToggleAction={() => setShowPassword(!showPassword)}
                  t={t}
                />
              </FieldGroup>

              <div className="flex items-center justify-end -mt-1">
                <Link
                  href="/forgot-password"
                  onClick={() => markForgotPasswordIntent()}
                  className="text-sm font-medium text-leaf-strong hover:text-primary"
                >
                  {t('auth.forgotPassword')}
                </Link>
              </div>

              {error && <ErrorBanner>{error}</ErrorBanner>}

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 rounded-full bg-leaf text-primary-deepest text-sm font-semibold hover:bg-leaf-strong hover:shadow-lg hover:shadow-leaf/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                {isLoading ? t('auth.signingIn') : t('auth.signIn')}
                {!isLoading && <ArrowRight className="h-4 w-4" />}
              </Button>
            </form>

            <Divider>{t('auth.orContinueWith')}</Divider>

            <GoogleButton label={t('auth.signInGoogle')} />

            <p className="text-center text-sm text-foreground/60 mt-5">
              {t('auth.noAccount')}
              <Link href="/register" className="font-semibold text-primary-deepest hover:text-leaf-strong">
                {t('auth.signUp')}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
