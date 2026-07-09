"use client"

import { Suspense, useEffect, useState, useRef } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { CheckCircle2, Loader2, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AUTH_IMG, AuthLoadingFallback, AuthVisual, BrandMark, ErrorBanner } from "@/lib/auth-shared"
import { apiClient } from "@/lib/api/client"
import { getApiErrorMessage } from "@/lib/api/errors"
import {
  storeAuthSession,
  storeChallengeToken,
  storeCurrentUser,
  storeResetPasswordToken,
  markResetPasswordIntent,
  type AuthUser,
} from "@/lib/auth-session"

function AuthCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading")
  const [message, setMessage] = useState("Memproses autentikasi...")
  const hasProcessed = useRef(false)

  useEffect(() => {
    if (hasProcessed.current) return
    hasProcessed.current = true

    // Backend mengirim token lewat URL FRAGMENT (#type=...&token=...) yang
    // tidak pernah dikirim ke server mana pun. Query string tetap dibaca
    // sebagai fallback untuk tautan email lama.
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""))
    const type = hashParams.get("type") ?? searchParams.get("type")
    const token = hashParams.get("token") ?? searchParams.get("token")
    const exchangeCode =
      hashParams.get("exchange_code") ?? searchParams.get("exchange_code")

    // Bersihkan address bar SEGERA — token tidak boleh tersisa di riwayat
    // browser, tampilan layar, maupun header Referer.
    if (token || exchangeCode || window.location.hash) {
      window.history.replaceState({}, document.title, window.location.pathname)
    }

    const completeCallback = async () => {
      try {
        if (type === "reset-password" && token) {
          markResetPasswordIntent()
          // Token dibawa lewat sessionStorage, bukan query string.
          storeResetPasswordToken(token)
          router.replace("/reset-password")
          return
        }

        if (type === "verify-email" && token) {
          await apiClient.post("/auth/verify-email", { token })
          setStatus("success")
          setMessage("Email berhasil diverifikasi. Mengalihkan ke halaman login...")
          window.setTimeout(() => router.replace("/login"), 1200)
          return
        }

        if (type === "oauth" && exchangeCode) {
          // Interceptor axios sudah meng-unwrap response.data.
          const data = (await apiClient.post(
            "/auth/exchange-oauth",
            { exchange_code: exchangeCode },
          )) as any

          if (data.requires_2fa && data.challenge_token) {
            // Challenge token cukup di sessionStorage — tidak lewat URL.
            storeChallengeToken(data.challenge_token)
            router.replace("/login/verify-2fa")
            return
          }

          if (data.access_token && data.refresh_token) {
            // Simpan respons utuh: expires_in + user ikut tercatat sehingga
            // token_expires_at/user tidak lagi hilang untuk login Google.
            storeAuthSession(data)

            if (!data.user) {
              try {
                const user = (await apiClient.get("/users/me")) as AuthUser
                storeCurrentUser(user)
              } catch {
                // Token tetap valid; profil akan diambil ulang oleh halaman terlindungi.
              }
            }

            setStatus("success")
            setMessage("Login Google berhasil. Mengalihkan ke dashboard...")
            window.setTimeout(() => router.replace("/home"), 800)
            return
          }
        }

        throw new Error("Tautan autentikasi tidak lengkap atau sudah tidak valid.")
      } catch (err: unknown) {
        setStatus("error")
        setMessage(getApiErrorMessage(err, "Gagal memproses tautan autentikasi."))
      }
    }

    completeCallback()
  }, [router, searchParams])

  return (
    <div className="min-h-screen w-full bg-surface-soft lg:flex lg:h-screen lg:overflow-hidden">
      <AuthVisual title="Mengamankan sesi Hanjeli" desc="Kami sedang menyelaraskan autentikasi Anda dengan backend Hanjeli SmartFarm." imgSrc={AUTH_IMG.verifyEmail} />

      <div className="flex-1 flex flex-col lg:overflow-y-auto">
        <header className="lg:hidden flex items-center justify-center px-5 py-3 border-b border-border/50 bg-surface-soft">
          <BrandMark />
        </header>

        <div className="flex-1 flex items-center justify-center px-5 py-6 sm:px-8 lg:px-14 lg:py-4">
          <div className="w-full max-w-md">
            <div className="hidden lg:flex items-center justify-between mb-6">
              <BrandMark />
            </div>

            <div className="text-center lg:text-left">
              <div className="mb-4 mx-auto lg:mx-0 flex h-14 w-14 items-center justify-center rounded-2xl bg-leaf/30">
                {status === "loading" && <Loader2 className="h-7 w-7 animate-spin text-primary-deepest" />}
                {status === "success" && <CheckCircle2 className="h-7 w-7 text-primary-deepest" />}
                {status === "error" && <XCircle className="h-7 w-7 text-error" />}
              </div>

              <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
                Callback Autentikasi
              </h1>

              <p className="mt-2 text-sm text-foreground/60 leading-relaxed">
                {message}
              </p>

              {status === "error" && (
                <div className="mt-5 space-y-3">
                  <ErrorBanner>{message}</ErrorBanner>
                  <Link href="/login" className="block">
                    <Button className="w-full h-12 rounded-full bg-leaf text-primary-deepest text-sm font-semibold hover:bg-leaf-strong hover:shadow-lg hover:shadow-leaf/30 transition-all">
                      Kembali ke Login
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<AuthLoadingFallback />}>
      <AuthCallbackContent />
    </Suspense>
  )
}
