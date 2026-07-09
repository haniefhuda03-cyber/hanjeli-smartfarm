import type { Metadata, Viewport } from 'next'
import { Lexend, Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'
import { I18nProvider } from '@/components/i18n-provider'
import { DashboardLayout } from '@/components/dashboard-layout'
import { RouteGuard } from '@/components/route-guard'
import { Toaster } from '@/components/ui/sonner'
import { NotificationProvider } from '@/contexts/notification-context'
import { MobileMaintenanceGate } from '@/components/mobile-maintenance-gate'
import { QueryProvider } from '@/providers/query-provider'
import { SocketProvider } from '@/providers/socket-provider'

const lexend = Lexend({ 
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-lexend"
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-jakarta"
});

export const metadata: Metadata = {
  title: {
    default: 'Hanjeli - Smart Farm Management',
    template: '%s | Hanjeli Smart Farm',
  },
  description: 'Sistem manajemen pertanian cerdas berbasis IoT. Pantau sensor, kelola irigasi, dan optimalkan hasil panen dengan data real-time.',
  keywords: ['smart farm', 'pertanian cerdas', 'IoT', 'monitoring', 'irigasi', 'hanjeli', 'precision agriculture'],
  authors: [{ name: 'Hanjeli Team' }],
  openGraph: {
    type: 'website',
    locale: 'id_ID',
    siteName: 'Hanjeli Smart Farm',
    title: 'Hanjeli - Smart Farm Management',
    description: 'Sistem manajemen pertanian cerdas berbasis IoT untuk pertanian modern.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hanjeli - Smart Farm Management',
    description: 'Sistem manajemen pertanian cerdas berbasis IoT.',
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#006c49',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body className={`${lexend.variable} ${jakarta.variable} font-sans antialiased`} suppressHydrationWarning>
        <QueryProvider>
          <I18nProvider>
            <SocketProvider>
              <NotificationProvider>
                <MobileMaintenanceGate>
                  <Toaster position="top-center" richColors closeButton />
                  <RouteGuard>
                    <DashboardLayout>
                      {children}
                    </DashboardLayout>
                  </RouteGuard>
                </MobileMaintenanceGate>
              </NotificationProvider>
            </SocketProvider>
          </I18nProvider>
        </QueryProvider>
      </body>
    </html>
  )
}
