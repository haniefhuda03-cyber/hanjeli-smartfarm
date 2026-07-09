import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Lupa Kata Sandi',
  description: 'Pulihkan akses ke akun Hanjeli Smart Farm Anda dengan reset kata sandi.',
  openGraph: { title: 'Lupa Kata Sandi — Reset Akses' },
  robots: { index: false, follow: false },
}

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return children
}
