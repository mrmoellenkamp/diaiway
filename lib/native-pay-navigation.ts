import { Capacitor } from "@capacitor/core"

/**
 * Native Zahlungs-Flow (Wallet / Buchung):
 * - **Nur iOS:** `Browser.open` (SFSafariViewController).
 * - **Android und jede andere native Umgebung:** immer `window.location.assign` in der **Haupt-WebView**.
 *   Grund: `Capacitor.getPlatform()` liefert in manchen Android-Setups (Remote `server.url`) nicht zuverlässig
 *   `"android"` – dann wurde fälschlich `Browser.open` genutzt (Custom Tabs → kein sauberer Return / keine Session).
 * - `diaiway://…` nach Checkout wird von der WebView zuverlässiger an die App gemeldet als aus Chrome heraus.
 *
 * @param pathWithQuery z. B. `/pay/wallet?token=…` oder `/pay/<id>?token=…`
 */
export async function openNativeStripePayUrl(pathWithQuery: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return

  const path = pathWithQuery.startsWith("/") ? pathWithQuery : `/${pathWithQuery}`

  if (Capacitor.getPlatform() === "ios") {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://diaiway.com"
    const url = `${origin}${path}`
    const { Browser } = await import("@capacitor/browser")
    await Browser.open({ url, presentationStyle: "fullscreen" })
    return
  }

  window.location.assign(path)
}
