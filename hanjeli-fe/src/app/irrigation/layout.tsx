import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Irigasi',
  description: 'Kontrol dan jadwalkan sistem irigasi pertanian cerdas Hanjeli Anda.',
  openGraph: { title: 'Irigasi — Kontrol Otomatis' },
}

export default function IrrigationLayout({ children }: { children: React.ReactNode }) {
  return children
}
