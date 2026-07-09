import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Daftar',
  description: 'Buat akun Hanjeli Smart Farm untuk mulai mengelola pertanian cerdas Anda.',
  openGraph: { title: 'Daftar — Buat Akun Hanjeli' },
  robots: { index: false, follow: false },
}

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children
}
