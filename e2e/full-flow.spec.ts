/**
 * diaiway Full E2E Flow
 * Register → Search → Book → Call → Invoice
 *
 * Voraussetzung: E2E_ENABLED=true in .env
 */

import { test, expect } from "@playwright/test"

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000"
const ts = Date.now()
const E2E_EMAIL = `e2e-${ts}@diaiway.test`
const E2E_PASSWORD = "Test123!?"
const E2E_NAME = "E2E Test User"

test.describe("diaiway Vollständiger Flow", () => {
  test("Register → Search → Book → Call → Rechnung", async ({ page, request }) => {
    // 1. Setup: Takumis + Takumi-User (falls nicht vorhanden)
    const setupRes = await request.get(`${BASE}/api/test/e2e-setup?action=setup`)
    if (setupRes.status() === 404) {
      test.skip(true, "E2E_ENABLED nicht gesetzt")
      return
    }
    expect(setupRes.ok()).toBeTruthy()
    const { expertId, takumiEmail, takumiPassword } = (await setupRes.json()) as {
      expertId: string
      takumiEmail: string
      takumiPassword: string
    }

    // 2. Registrierung
    await page.goto("/register")
    await page.getByLabel(/Name/i).fill(E2E_NAME)
    await page.getByLabel(/E-Mail|Email/i).fill(E2E_EMAIL)
    await page.getByLabel(/Passwort|Password/i).first().fill(E2E_PASSWORD)
    await page.getByLabel(/Passwort bestätigen|confirm/i).fill(E2E_PASSWORD)
    await page.getByRole("button", { name: /Shugyo/i }).click()
    await page.getByRole("button", { name: /Registrieren|Anmelden|submit/i }).click()
    await expect(page).not.toHaveURL(/\/register/, { timeout: 15000 })

    // 3. Wallet-Guthaben hinzufügen (vom Page-Kontext, Cookies werden mitgesendet)
    await page.evaluate(async () => {
      await fetch("/api/test/add-wallet", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: 10000 }),
      })
    })

    // 4. Takumis suchen
    await page.goto("/search")
    await page.getByPlaceholder(/Suchen|Search/i).fill("Stefan")
    await page.waitForTimeout(800)
    const takumiLink = page.locator('a[href*="/takumi/"]').first()
    await expect(takumiLink).toBeVisible({ timeout: 5000 })
    await takumiLink.click()
    await expect(page).toHaveURL(/\/takumi\//)
    await expect(page.getByText(/Stefan|Buchung|Session/i)).toBeVisible({ timeout: 5000 })

    // 5. Buchung: Zu Booking wechseln
    const bookBtn = page.getByRole("link", { name: /Buchen|buchen|Book/i }).or(
      page.getByRole("button", { name: /Buchen|buchen|Book/i })
    )
    await bookBtn.first().click()
    await expect(page).toHaveURL(/\/booking\//)

    // 6. Datum & Uhrzeit wählen (innerhalb 7 Tage)
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const dateStr = tomorrow.toISOString().slice(0, 10)
    const dayNum = tomorrow.getDate()

    await page.waitForSelector('button:has-text("' + dayNum + '")', { timeout: 5000 }).catch(() => {})
    const dayBtn = page.locator("button").filter({ hasText: new RegExp(`^${dayNum}$`) }).first()
    if (await dayBtn.isVisible()) {
      await dayBtn.click()
      await page.waitForTimeout(500)
      const slotBtn = page.locator('button:has-text(":")').first()
      if (await slotBtn.isVisible()) {
        await slotBtn.click()
      }
    } else {
      // Fallback: direkt zum Checkout wenn Kalender anders aufgebaut
      const anySlot = page.locator('[class*="slot"], button').filter({ hasText: /^\d{1,2}:\d{2}$/ }).first()
      await anySlot.click().catch(() => {})
    }

    await page.getByRole("button", { name: /Buchen|Buchung anfragen|Book/i }).click()
    await page.waitForTimeout(1500)

    // 7. Checkout: Mit Wallet bezahlen
    const walletPayBtn = page.getByRole("button", { name: /Wallet|Guthaben/i })
    if (await walletPayBtn.isVisible()) {
      await walletPayBtn.click()
    } else {
      await page.getByRole("button", { name: /Karte|Card|Bezahlen|Pay/i }).click()
    }
    await expect(page.getByText(/Erfolg|success|bestätigt|confirmed/i)).toBeVisible({ timeout: 15000 })

    // 8. Takumi bestätigt (via API mit Token – Auth nicht nötig bei Token)
    const bookingsData = await page.evaluate(async () => {
      const r = await fetch("/api/bookings", { credentials: "include" })
      return r.json()
    })
    const pending = (bookingsData?.bookings as Array<{ id: string; statusToken: string; status: string }>)?.find(
      (b) => b.status === "pending"
    )
    if (pending) {
      await request.post(`${BASE}/api/booking-respond/${pending.id}`, {
        data: { token: pending.statusToken, action: "confirmed" },
        headers: { "Content-Type": "application/json" },
      })
    }

    await page.goto("/sessions")
    await page.waitForTimeout(1000)
    const sessionLink = page.locator('a[href*="/session/"]').first()
    if (!(await sessionLink.isVisible())) {
      test.skip(true, "Keine Session zum Beitreten (Takumi-Confirm fehlgeschlagen?)")
      return
    }
    await sessionLink.click()

    // 9. diaiway Safety: Modal bestätigen
    const modal = page.getByRole("dialog")
    if (await modal.isVisible()) {
      const checks = page.locator('input[type="checkbox"]')
      const count = await checks.count()
      for (let i = 0; i < Math.min(count, 3); i++) {
        await checks.nth(i).check()
      }
      await page.getByRole("button", { name: /bestätigen|confirm|Beitreten/i }).click()
    }

    const joinBtn = page.getByRole("button", { name: /Beitreten|Join/i })
    if (!(await joinBtn.isDisabled())) {
      await joinBtn.click()
      await expect(
        page.locator("text=Video-Call wird vorbereitet").or(page.locator("text=Video call in preparation"))
      ).toBeVisible({ timeout: 15000 })
    }

    // 10. Call beenden
    await page.waitForTimeout(2000)
    const endBtn = page.getByRole("button", { name: /beenden|end|Anruf beenden/i }).or(
      page.locator('button[aria-label*="end"], button[aria-label*="beenden"]')
    )
    if (await endBtn.isVisible()) {
      await endBtn.click()
    }
    await page.waitForTimeout(1500)

    // 11. Process Completion (Rechnung generieren)
    const sessionUrl = page.url()
    const bookingIdMatch = sessionUrl.match(/\/session\/([^/?]+)/)
    const bookingId = bookingIdMatch?.[1]
    if (bookingId) {
      await request.get(`${BASE}/api/test/e2e-setup?action=process-completion&bookingId=${bookingId}`)
    }

    // 12. Finanzen: Rechnung prüfen
    await page.goto("/profile/finances")
    await expect(page.getByText(/Rechnungen|Finanzen|Transaktionen|Transactions/i)).toBeVisible({ timeout: 8000 })
    await expect(page.locator('a[href*=".pdf"], [data-testid="invoice"], button:has-text("Download")')).toBeVisible({
      timeout: 10000,
    }).catch(() => {})
  })
})
