"use client"

import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { evaluatePassword } from "@/lib/password"

type TFunc = ReturnType<typeof useTranslation>["t"]

/**
 * Meter kekuatan + checklist syarat kata sandi — dipakai bersama oleh register,
 * reset password, ganti kata sandi, dan form kelola akun (konsisten & DRY).
 * Menampilkan bar 4-segmen + daftar syarat. Baris "cocok" hanya muncul bila
 * `showMatch` aktif (form yang punya konfirmasi kata sandi).
 */
export function PasswordStrength({
  password,
  confirmPassword = "",
  showMatch = true,
  t,
  className,
}: {
  password: string
  confirmPassword?: string
  showMatch?: boolean
  t: TFunc
  className?: string
}) {
  const { requirements, score } = evaluatePassword(password)

  const strengthLabel =
    score <= 1 ? t("auth.passwordWeak", "Lemah") :
    score === 2 ? t("auth.passwordFair", "Cukup") :
    score === 3 ? t("auth.passwordGood", "Baik") :
    t("auth.passwordStrong", "Kuat")
  const strengthColor =
    score <= 1 ? "bg-error" :
    score === 2 ? "bg-warning-strong" :
    "bg-leaf-strong"
  const strengthTextColor =
    score <= 1 ? "text-error" :
    score === 2 ? "text-warning-foreground" :
    "text-leaf-strong"

  return (
    <div className={cn("rounded-xl bg-surface-sage-soft p-2.5 space-y-1.5", className)} aria-live="polite">
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
        {showMatch && (
          <ReqLine ok={confirmPassword.length > 0 && password === confirmPassword}>
            {t("auth.passwordMatch", "Kata sandi konfirmasi cocok")}
          </ReqLine>
        )}
      </ul>
    </div>
  )
}

function ReqLine({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <li className={cn("text-[11px] flex items-center gap-1.5", ok ? "text-leaf-strong" : "text-foreground/40")}>
      <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span className="truncate">{children}</span>
    </li>
  )
}
