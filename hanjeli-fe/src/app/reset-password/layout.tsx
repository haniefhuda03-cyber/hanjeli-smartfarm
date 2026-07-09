import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Reset Kata Sandi',
  description: 'Atur ulang kata sandi akun Hanjeli Smart Farm Anda.',
  openGraph: { title: 'Reset Kata Sandi' },
  robots: { index: false, follow: false },
}

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children
}
