import Link from "next/link";
import type { Metadata } from "next";
import { ShieldCheckIcon, MailCheckIcon } from "@/components/icons/toast-icons";

export const metadata: Metadata = {
  title: "Reset Password Berhasil — Hanjeli Smartfarm",
  description:
    "Permintaan reset password Anda berhasil. Periksa kotak masuk email untuk melanjutkan.",
};

type PageProps = {
  searchParams: Promise<{ email?: string }>;
};

export default async function ResetPasswordSuccessPage({ searchParams }: PageProps) {
  const { email } = await searchParams;
  const maskedEmail = email ? maskEmail(email) : "email Anda";

  return (
    <main className="flex min-h-[calc(100dvh-1px)] flex-1 items-center justify-center bg-linear-to-br from-emerald-50 via-white to-blue-50 px-4 py-12 dark:from-emerald-950/40 dark:via-zinc-950 dark:to-blue-950/40">
      <section className="w-full max-w-md overflow-hidden rounded-3xl border border-zinc-200/80 bg-white/90 shadow-xl shadow-emerald-900/5 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/80">
        <div className="relative h-2 w-full bg-linear-to-r from-emerald-400 via-emerald-500 to-teal-500" />

        <div className="flex flex-col items-center gap-6 p-8 text-center sm:p-10">
          <div className="relative">
            <div className="absolute inset-0 animate-ping rounded-full bg-emerald-400/30" />
            <span className="relative inline-flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 ring-8 ring-emerald-50 dark:bg-emerald-900/60 dark:text-emerald-300 dark:ring-emerald-950/60">
              <ShieldCheckIcon width={36} height={36} />
            </span>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
              Tautan reset terkirim
            </h1>
            <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400 sm:text-base">
              Kami sudah mengirimkan tautan reset password ke{" "}
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                {maskedEmail}
              </span>
              . Tautan ini hanya berlaku selama{" "}
              <span className="font-semibold">30 menit</span>.
            </p>
          </div>

          <div className="w-full rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 text-left dark:border-emerald-900/60 dark:bg-emerald-950/30">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/60 dark:text-emerald-300">
                <MailCheckIcon width={18} height={18} />
              </span>
              <div className="text-sm text-emerald-900/90 dark:text-emerald-100/90">
                <p className="font-semibold">Belum menerima email?</p>
                <ul className="mt-1.5 list-disc space-y-1 pl-4 text-emerald-800/80 dark:text-emerald-200/80">
                  <li>Periksa folder spam atau promosi Anda</li>
                  <li>Pastikan alamat email yang Anda masukkan benar</li>
                  <li>Tunggu hingga 1 menit, kemudian minta tautan baru</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="flex w-full flex-col gap-2 sm:flex-row">
            <Link
              href="/login"
              className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
            >
              Kembali ke Login
            </Link>
            <Link
              href="/reset-password"
              className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-zinc-200 bg-white px-5 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Kirim Ulang
            </Link>
          </div>

          <p className="text-xs text-zinc-500 dark:text-zinc-500">
            Butuh bantuan?{" "}
            <Link
              href="/support"
              className="font-medium text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-400"
            >
              Hubungi tim dukungan
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain || local.length <= 2) return email;
  const visible = local.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(local.length - 2, 3))}@${domain}`;
}
