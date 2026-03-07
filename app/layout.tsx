import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono, Noto_Sans_JP } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from 'sonner'
import { AppProvider } from '@/lib/app-context'
import { I18nProvider } from '@/lib/i18n'
import { SessionProvider } from '@/components/session-provider'
import { AiMentorFab } from '@/components/ai-mentor-fab'
import { GlobalNavigation } from '@/components/global-navigation'
import { GlobalFooter } from '@/components/global-footer'
import { ErrorBoundary } from '@/components/error-boundary'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })
const _notoJP = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-jp",
})

export const metadata: Metadata = {
  title: 'diAiway -- Dein Support ist bereit',
  description: 'Expert-on-Demand Marketplace. Finde deinen Takumi und löse jedes Problem per Live-Video.',
  generator: 'diAiway',
  manifest: '/manifest.json',
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
  themeColor: '#064e3b',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="de" className={_notoJP.variable}>
      <body className="font-sans antialiased">
        <ErrorBoundary>
          <SessionProvider>
            <I18nProvider>
              <AppProvider>
                <GlobalNavigation />
                {children}
                <GlobalFooter />
                <AiMentorFab />
              </AppProvider>
            </I18nProvider>
          </SessionProvider>
        </ErrorBoundary>
        <Toaster position="top-center" richColors />
        <Analytics />
      </body>
    </html>
  )
}
