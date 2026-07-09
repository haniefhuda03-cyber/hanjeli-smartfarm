import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Profil',
  description: 'Kelola profil, keamanan, perangkat IoT, dan preferensi akun Hanjeli Anda.',
  openGraph: { title: 'Profil — Pengaturan Akun' },
}

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return children
}
