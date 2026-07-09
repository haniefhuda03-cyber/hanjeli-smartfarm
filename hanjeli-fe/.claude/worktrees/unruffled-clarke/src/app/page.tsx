import Link from "next/link";
import {
  LeafIcon,
  ShieldCheckIcon,
  InfoIcon,
} from "@/components/icons/toast-icons";

const quickLinks = [
  {
    href: "/dev/playground",
    title: "UI Playground",
    description:
      "Trigger semua varian Sonner toast & lihat semua UI state pada satu halaman.",
    badge: "Dev",
    Icon: InfoIcon,
  },
  {
    href: "/reset-password/success?email=petani@hanjeli.id",
    title: "Reset Password Berhasil",
    description:
      "Halaman konfirmasi setelah permintaan reset password terkirim.",
    badge: "Auth Flow",
    Icon: ShieldCheckIcon,
  },
];

export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center bg-linear-to-b from-emerald-50/60 via-white to-zinc-50 px-4 py-16 dark:from-emerald-950/30 dark:via-zinc-950 dark:to-black sm:px-6 lg:px-10">
      <div className="w-full max-w-3xl">
        <header className="mb-10 text-center sm:text-left">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
            <LeafIcon width={14} height={14} />
            Hanjeli Smartfarm
          </div>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl">
            Frontend Foundation
          </h1>
          <p className="mt-2 max-w-xl text-sm text-zinc-600 dark:text-zinc-400 sm:text-base">
            Setup awal: notifikasi Sonner kontekstual, UI state lengkap, dan
            playground internal untuk pengujian visual.
          </p>
        </header>

        <ul className="grid gap-4 sm:grid-cols-2">
          {quickLinks.map(({ href, title, description, badge, Icon }) => (
            <li key={href}>
              <Link
                href={href}
                className="group flex h-full flex-col rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-emerald-700"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300">
                    <Icon width={20} height={20} />
                  </span>
                  <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                    {badge}
                  </span>
                </div>
                <h2 className="mt-4 text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  {title}
                </h2>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  {description}
                </p>
                <span className="mt-4 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  Buka halaman →
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <footer className="mt-10 border-t border-zinc-200 pt-6 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-500">
          Dibangun dengan Next.js 16 · React 19 · Tailwind v4 · Sonner.
        </footer>
      </div>
    </main>
  );
}
