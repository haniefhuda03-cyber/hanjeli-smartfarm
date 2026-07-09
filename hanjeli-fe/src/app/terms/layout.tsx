import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "Syarat & Ketentuan",
  description:
    "Ketentuan penggunaan platform Hanjeli Smart Farm — hak, kewajiban, dan batasan tanggung jawab bagi pengguna layanan.",
  alternates: { canonical: "/terms" },
  openGraph: {
    title: "Syarat & Ketentuan | Hanjeli Smart Farm",
    description:
      "Ketentuan penggunaan platform Hanjeli Smart Farm — hak, kewajiban, dan batasan tanggung jawab pengguna.",
    url: "/terms",
    type: "article",
  },
}

export default function TermsLayout({ children }: { children: ReactNode }) {
  return children
}
