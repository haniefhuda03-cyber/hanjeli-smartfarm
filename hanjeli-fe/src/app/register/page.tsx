"use client"

import { useState, useMemo } from "react"
import { useTranslation } from "react-i18next"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Mail, Lock, User, ArrowLeft, ArrowRight, CheckCircle2, XCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import { useMutation } from "@tanstack/react-query"
import { authApi } from "@/lib/api/auth"
import {
  AUTH_IMG,
  AuthVisual,
  BrandMark,
  Divider,
  FieldGroup,
  FieldLabel,
  GoogleButton,
  PasswordToggle,
  authInputClass,
} from "@/lib/auth-shared"
import { getApiErrorMessage } from "@/lib/api/errors"
import { ErrorBanner } from "@/lib/auth-shared"
import { markVerifyEmailIntent } from "@/lib/auth-session"

type PasswordRequirements = {
  hasMinLength: boolean
  hasUppercase: boolean
  hasNumber: boolean
  hasSymbol: boolean
}

function evaluatePassword(value: string): { requirements: PasswordRequirements; score: number } {
  const requirements: PasswordRequirements = {
    hasMinLength: value.length >= 8,
    hasUppercase: /[A-Z]/.test(value),
    hasNumber: /[0-9]/.test(value),
    hasSymbol: /[^A-Za-z0-9]/.test(value),
  }
  const score = Object.values(requirements).filter(Boolean).length
  return { requirements, score }
}

type TFunc = ReturnType<typeof useTranslation>["t"]

function PasswordChecklist({
  password,
  confirmPassword,
  requirements,
  score,
  t,
}: {
  password: string
  confirmPassword: string
  requirements: PasswordRequirements
  score: number
  t: TFunc
}) {
  const strengthLabel =
    score <= 1 ? t("auth.passwordWeak", "Lemah") :
    score === 2 ? t("auth.passwordFair", "Cukup") :
    score === 3 ? t("auth.passwordGood", "Baik") :
    t("auth.passwordStrong", "Kuat")
  const strengthColor =
    score <= 1 ? "bg-error" :
    score === 2 ? "bg-warning-strong" :
    score === 3 ? "bg-leaf-strong" :
    "bg-leaf-strong"
  const strengthTextColor =
    score <= 1 ? "text-error" :
    score === 2 ? "text-warning-foreground" :
    "text-leaf-strong"

  return (
    <div className="rounded-xl bg-surface-sage-soft p-2.5 space-y-1.5" aria-live="polite">
      <div>
        <div className="flex items-center justify-between mb-1">
          <p className="text-[11px] font-semibold text-foreground/60">
            {t("auth.passwordStrength", "Kekuatan Kata Sandi")}
          </p>
          <p className={cn("text-[11px] font-semibold", password.length === 0 ? "text-foreground/40" : strengthTextColor)}>
            {password.length === 0 ? "—" : strengthLabel}
          </p>
        </div>
        <div className="flex gap-1" role="progressbar" aria-valuenow={score} aria-valuemin={0} aria-valuemax={4}>
          {[1, 2, 3, 4].map((seg) => (
            <div
              key={seg}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors",
                password.length > 0 && score >= seg ? strengthColor : "bg-border/60",
              )}
            />
          ))}
        </div>
      </div>

      <ul className="grid grid-cols-2 gap-x-3 gap-y-0.5">
        <ReqLine ok={requirements.hasMinLength}>{t("auth.passwordMinLength", "Minimal 8 karakter")}</ReqLine>
        <ReqLine ok={requirements.hasUppercase}>{t("auth.passwordUppercase", "Mengandung huruf besar")}</ReqLine>
        <ReqLine ok={requirements.hasNumber}>{t("auth.passwordNumber", "Mengandung angka")}</ReqLine>
        <ReqLine ok={requirements.hasSymbol}>{t("auth.passwordSymbol", "Mengandung simbol")}</ReqLine>
        <ReqLine ok={confirmPassword.length > 0 && password === confirmPassword}>
          {t("auth.passwordMatch", "Kata sandi konfirmasi cocok")}
        </ReqLine>
      </ul>
    </div>
  )
}

function ReqLine({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className={cn("text-[11px] flex items-center gap-1.5", ok ? "text-leaf-strong" : "text-foreground/40")}>
      <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span className="truncate">{children}</span>
    </li>
  )
}

export default function RegisterPage() {
  const router = useRouter()
  const { t } = useTranslation()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState("")
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    agreeTerms: false,
  })

  const { requirements, score } = useMemo(() => evaluatePassword(formData.password), [formData.password])
  const passwordsMatch = formData.password.length > 0 && formData.password === formData.confirmPassword
  const passwordValid = requirements.hasMinLength && requirements.hasUppercase && requirements.hasNumber

  const registerMutation = useMutation({
    mutationFn: authApi.register,
    onSuccess: () => {
      markVerifyEmailIntent(formData.email)
      router.push(`/register/verify-email?email=${encodeURIComponent(formData.email)}`)
    },
    onError: (err: unknown) => {
      setError(getApiErrorMessage(err, t('auth.registrationFailed', 'Registrasi gagal. Silakan coba lagi.')));
    }
  })

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    
    if (!passwordValid || !passwordsMatch || !formData.agreeTerms) return
    
    registerMutation.mutate({
      email: formData.email,
      password: formData.password,
      name: formData.fullName
    })
  }

  const isLoading = registerMutation.isPending

  return (
    <div className="min-h-screen w-full bg-surface-soft lg:flex lg:h-screen lg:overflow-hidden">
      <AuthVisual
        title={t("auth.joinHanjeli")}
        desc={t("auth.joinDesc")}
        imgSrc={AUTH_IMG.register}
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
            <div className="hidden lg:flex items-center justify-between mb-3">
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

            <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
              {t("auth.createAccount")}
            </h1>
            <p className="mt-1 text-sm text-foreground/60">{t("auth.fillDetails")}</p>

            <form onSubmit={handleRegister} className="mt-3 space-y-2">
              <FieldLabel>{t("auth.fullName")}</FieldLabel>
              <FieldGroup>
                <User className="absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-foreground/40" />
                <Input
                  type="text"
                  placeholder={t("auth.enterFullName")}
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className={authInputClass()}
                />
              </FieldGroup>

              <FieldLabel>{t("auth.email")}</FieldLabel>
              <FieldGroup>
                <Mail className="absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-foreground/40" />
                <Input
                  type="email"
                  placeholder={t("auth.enterEmail")}
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className={authInputClass()}
                />
              </FieldGroup>

              <FieldLabel>{t("auth.password")}</FieldLabel>
              <FieldGroup>
                <Lock className="absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-foreground/40" />
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder={t("auth.createPassword")}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className={authInputClass({ withRight: true })}
                />
                <PasswordToggle show={showPassword} onToggleAction={() => setShowPassword(!showPassword)} t={t} />
              </FieldGroup>

              {formData.password.length > 0 && (
                <PasswordChecklist
                  password={formData.password}
                  confirmPassword={formData.confirmPassword}
                  requirements={requirements}
                  score={score}
                  t={t}
                />
              )}

              <FieldLabel>{t("auth.confirmPassword")}</FieldLabel>
              <FieldGroup>
                <Lock className="absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-foreground/40" />
                <Input
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder={t("auth.confirmYourPassword")}
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className={cn(
                    authInputClass({ withRight: true }),
                    "pr-20",
                    formData.confirmPassword.length > 0 && !passwordsMatch
                      ? "border-error/50 focus:border-error focus:ring-error/20"
                      : "",
                  )}
                  aria-invalid={formData.confirmPassword.length > 0 && !passwordsMatch}
                />
                {formData.confirmPassword.length > 0 && (
                  <span
                    className="absolute right-11 top-1/2 -translate-y-1/2"
                    aria-live="polite"
                    aria-label={
                      passwordsMatch
                        ? t("auth.passwordMatch", "Kata sandi konfirmasi cocok")
                        : t("auth.passwordMismatch", "Kata sandi tidak cocok")
                    }
                  >
                    {passwordsMatch
                      ? <CheckCircle2 className="h-4 w-4 text-leaf-strong" />
                      : <XCircle className="h-4 w-4 text-error" />}
                  </span>
                )}
                <PasswordToggle show={showConfirmPassword} onToggleAction={() => setShowConfirmPassword(!showConfirmPassword)} t={t} />
              </FieldGroup>

              <label htmlFor="terms" className="flex items-start gap-2.5 cursor-pointer pt-1">
                <Checkbox
                  id="terms"
                  checked={formData.agreeTerms}
                  onCheckedChange={(checked) => setFormData({ ...formData, agreeTerms: checked as boolean })}
                  className="mt-0.5 border-border data-[state=checked]:bg-leaf-strong data-[state=checked]:border-leaf-strong"
                />
                <span className="text-xs leading-snug text-foreground/70">
                  {t("auth.agreeTerms")}
                  <Link
                    href="/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="font-medium text-primary-deepest hover:text-leaf-strong hover:underline"
                  >
                    {t("auth.termsOfService")}
                  </Link>
                  {t("auth.and")}
                  <Link
                    href="/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="font-medium text-primary-deepest hover:text-leaf-strong hover:underline"
                  >
                    {t("auth.privacyPolicy")}
                  </Link>
                </span>
              </label>

              {error && <ErrorBanner>{error}</ErrorBanner>}

              <Button
                type="submit"
                disabled={isLoading || !formData.agreeTerms || !passwordValid || !passwordsMatch}
                className="w-full h-11 rounded-full bg-leaf text-primary-deepest text-sm font-semibold hover:bg-leaf-strong hover:shadow-lg hover:shadow-leaf/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-1"
              >
                {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                {isLoading ? t("auth.creatingAccount") : t("auth.createAccount")}
                {!isLoading && <ArrowRight className="h-4 w-4" />}
              </Button>
            </form>

            <Divider>{t("auth.or")}</Divider>

            <GoogleButton label={t("auth.signUpGoogle")} />

            <p className="text-center text-sm text-foreground/60 mt-4 pb-2">
              {t("auth.alreadyHaveAccount")}
              <Link href="/login" className="font-semibold text-primary-deepest hover:text-leaf-strong">
                {t("auth.signIn")}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
