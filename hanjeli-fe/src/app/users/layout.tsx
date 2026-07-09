import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Akun Pengguna',
  description: 'Kelola akun pengguna dan hak akses sistem pertanian cerdas Hanjeli.',
  openGraph: { title: 'Akun Pengguna — Manajemen Akses' },
}

export default function UsersLayout({ children }: { children: React.ReactNode }) {
  return children
}
