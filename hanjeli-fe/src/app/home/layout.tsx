import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Beranda',
  description: 'Dashboard pemantauan kondisi lahan, sensor IoT, dan perangkat pertanian Anda secara real-time.',
  openGraph: { title: 'Beranda — Dashboard Pertanian Cerdas' },
}

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return children
}
