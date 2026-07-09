import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "Kebijakan Privasi",
  description:
    "Bagaimana Hanjeli Smart Farm mengumpulkan, menggunakan, menyimpan, dan melindungi data pribadi serta data sensor Anda.",
  alternates: { canonical: "/privacy" },
  openGraph: {
    title: "Kebijakan Privasi | Hanjeli Smart Farm",
    description:
      "Bagaimana Hanjeli Smart Farm mengumpulkan, menggunakan, menyimpan, dan melindungi data Anda.",
    url: "/privacy",
    type: "article",
  },
}

export default function PrivacyLayout({ children }: { children: ReactNode }) {
  return children
}
