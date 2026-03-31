import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono, Noto_Sans_JP } from 'next/font/google'
import { Toaster } from 'sonner'
import { AppProvider } from '@/lib/app-context'
import { I18nProvider } from '@/lib/i18n'
import { SessionProvider } from '@/components/session-provider'
import { AiMentorFab } from '@/components/ai-mentor-fab'
import { GlobalNavigation } from '@/components/global-navigation'
import { ErrorBoundary } from '@/components/error-boundary'
import { PushNotificationProvider } from '@/components/push-notification-provider'
import { QuickActionPushProvider } from '@/components/quick-action-push-provider'
import { SessionActivityProvider } from '@/components/session-activity-provider'
import { SessionTimeoutWarning } from '@/components/session-timeout-warning'
import { TakumiPresenceUpdater } from '@/components/takumi-presence-updater'
import { InstantRequestOverlay } from '@/components/instant-request-overlay'
import { WalletTopupProvider } from '@/lib/wallet-topup-context'
import { ScrollToTop } from '@/components/scroll-to-top'
import { PullToRefresh } from '@/components/pull-to-refresh'
import { SplashScreenHider } from '@/components/splash-screen-hider'
import { DeepLinkHandler } from '@/components/deep-link-handler'
import { LogoutBackGuard } from '@/components/logout-back-guard'
import { SiteAnalyticsTracker } from '@/components/site-analytics-tracker'
import { Footer } from '@/components/footer'
import { VercelAnalytics } from '@/components/vercel-analytics'
import './globals.css'

// display: optional + system fallbacks: vermeidet unsichtbaren Text (FOIT) in älteren Android-WebViews
const _geist = Geist({
  subsets: ["latin"],
  display: "optional",
  adjustFontFallback: true,
  fallback: ["system-ui", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"],
})
const _geistMono = Geist_Mono({
  subsets: ["latin"],
  display: "optional",
  adjustFontFallback: true,
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
})
const _notoJP = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-jp",
  display: "optional",
  adjustFontFallback: true,
  fallback: [
    "Hiragino Sans",
    "Hiragino Kaku Gothic ProN",
    "Yu Gothic UI",
    "Meiryo",
    "system-ui",
    "sans-serif",
  ],
})

export const metadata: Metadata = {
  title: 'diAiway -- Dein Support ist bereit',
  description: 'Expert-on-Demand Marketplace. Finde deinen Takumi und löse jedes Problem per Live-Video.',
  generator: 'diAiway',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/icons/icon-192.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'diAiway',
  },
}

export const viewport: Viewport = {
  themeColor: '#064e3b',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover', // Enables safe-area-inset-* on iOS notch devices
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="de"
      suppressHydrationWarning
      className={`${(_geist as { variable?: string }).variable ?? ""} ${(_geistMono as { variable?: string }).variable ?? ""} ${(_notoJP as { variable?: string }).variable ?? ""}`.trim()}
    >
      {/*
        suppressHydrationWarning nur auf <html> (next-themes / lang). Auf <body> kann es in React 19
        zu leerem/weißem ersten Paint in manchen WebViews führen.
        Inline-Hintergrund: erster Paint auch wenn CSS-Chunks verzögern (Capacitor-Emulator).
      */}
      <body
        className="font-sans antialiased app-bottom-space"
        style={{ backgroundColor: "#fafaf9", minHeight: "100dvh" }}
      >
        <ErrorBoundary>
          <SessionProvider>
            <SiteAnalyticsTracker />
            <SessionActivityProvider>
              <I18nProvider>
                <AppProvider>
                  <WalletTopupProvider>
                  <PushNotificationProvider>
                    <QuickActionPushProvider>
                    <DeepLinkHandler />
                    <LogoutBackGuard />
                    <SplashScreenHider />
                    <ScrollToTop />
                    <PullToRefresh />
                    <GlobalNavigation />
                    {children}
                    <Footer />
                    <AiMentorFab />
                    <SessionTimeoutWarning />
                    <TakumiPresenceUpdater />
                    <InstantRequestOverlay />
                    </QuickActionPushProvider>
                  </PushNotificationProvider>
                  </WalletTopupProvider>
                </AppProvider>
              </I18nProvider>
            </SessionActivityProvider>
          </SessionProvider>
        </ErrorBoundary>
        <Toaster position="top-center" richColors expand={false} />
        <VercelAnalytics />
      </body>
    </html>
  )
}
