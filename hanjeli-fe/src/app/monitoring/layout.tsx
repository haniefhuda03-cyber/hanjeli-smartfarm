import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Monitoring',
  description: 'Pantau kondisi sensor tanah, kelembapan, suhu, dan pH lahan Hanjeli Anda secara menyeluruh.',
  openGraph: { title: 'Monitoring — Pantau Sensor Real-time' },
}

export default function MonitoringLayout({ children }: { children: React.ReactNode }) {
  return children
}
