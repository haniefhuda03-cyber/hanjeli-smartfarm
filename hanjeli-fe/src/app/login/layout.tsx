import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Masuk',
  description: 'Masuk ke akun Hanjeli Smart Farm Anda untuk memantau dan mengelola pertanian cerdas.',
  openGraph: { title: 'Masuk — Login Hanjeli' },
  robots: { index: false, follow: false },
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children
}
