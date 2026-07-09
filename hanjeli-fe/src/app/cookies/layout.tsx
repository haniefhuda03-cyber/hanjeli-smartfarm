import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "Pengaturan Cookie",
  description:
    "Kelola preferensi cookie Anda di Hanjeli Smart Farm — cookie esensial, analitik, fungsional, dan pemasaran.",
  alternates: { canonical: "/cookies" },
  openGraph: {
    title: "Pengaturan Cookie | Hanjeli Smart Farm",
    description:
      "Kelola preferensi cookie Anda di Hanjeli Smart Farm — esensial, analitik, fungsional, dan pemasaran.",
    url: "/cookies",
    type: "article",
  },
}

export default function CookiesLayout({ children }: { children: ReactNode }) {
  return children
}
