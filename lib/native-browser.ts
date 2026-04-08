import { Capacitor } from "@capacitor/core"

/**
 * Öffnet eine URL im nativen externen Browser:
 * - iOS:     SFSafariViewController (@capacitor/browser)
 * - Android: Chrome Custom Tabs     (@capacitor/browser)
 * - Web:     neues Tab (window.open)
 *
 * Dadurch findet die Wallet-Aufladung nachweislich außerhalb der App-WebView
 * statt – konform mit Apple Guideline 3.1.1 und Google Play Guideline 4.8.
 */
export async function openExternalBrowser(url: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const { Browser } = await import("@capacitor/browser")
    await Browser.open({ url })
    return
  }
  window.open(url, "_blank", "noopener,noreferrer")
}
