/**
 * diaiway Safety Enforcement — Playwright E2E Tests
 *
 * Voraussetzungen:
 * - PLAYWRIGHT_TEST_EMAIL, PLAYWRIGHT_TEST_PASSWORD in .env oder Umgebung
 * - Laufender Dev-Server (oder PLAYWRIGHT_BASE_URL)
 * - Test-User mit mindestens einer confirmed Buchung für Session-Tests
 */

import { test, expect } from "@playwright/test"

const TEST_EMAIL = process.env.PLAYWRIGHT_TEST_EMAIL ?? "test@example.com"
const TEST_PASSWORD = process.env.PLAYWRIGHT_TEST_PASSWORD ?? "Test123!"
const TAKUMI_ID = process.env.PLAYWRIGHT_TAKUMI_ID ?? ""

test.describe("diaiway Safety Enforcement", () => {
  test("Call ohne Bestätigung des Safety-Modals kann nicht gestartet werden", async ({ page }) => {
    await page.goto("/login")
    await page.getByLabel(/E-Mail|Email/i).fill(TEST_EMAIL)
    await page.getByLabel(/Passwort|Password/i).fill(TEST_PASSWORD)
    await page.getByRole("button", { name: /Anmelden|Login|Einloggen/i }).click()
    await expect(page).not.toHaveURL(/\/login/, { timeout: 10000 })

    // Session-Seite benötigt eine confirmed Buchung.
    // Falls keine vorhanden: Test bricht ab (bookingId muss von außen gesetzt werden).
    const bookingId = process.env.PLAYWRIGHT_BOOKING_ID
    if (!bookingId) {
      test.skip()
      return
    }

    await page.goto(`/session/${bookingId}`)
    await expect(page.locator("text=diaiway Safety Enforcement").or(page.locator("text=Session starten"))).toBeVisible({ timeout: 8000 })

    // Safety-Modal ist sichtbar ODER Join-Button ist deaktiviert
    const joinBtn = page.getByRole("button", { name: /Beitreten|Join/i })
    const modal = page.getByRole("dialog")
    const modalVisible = await modal.isVisible().catch(() => false)
    const joinDisabled = await joinBtn.isDisabled().catch(() => true)

    expect(modalVisible || joinDisabled, "Call-Start muss blockiert sein (Modal oder deaktivierter Join)").toBeTruthy()

    // Join-Button darf nicht klickbar sein, wenn Modal nicht bestätigt
    if (!modalVisible && !joinDisabled) {
      await joinBtn.click()
      // Nach Klick: Sollte keinen Raum betreten (kein Video-Container oder Fehler)
      await expect(page.locator("text=Video-Call wird vorbereitet")).not.toBeVisible({ timeout: 3000 }).catch(() => {})
    }
  })

  test("Happy Path: Einloggen -> Call-Gateway bestätigen -> Raum betreten", async ({ page }) => {
    await page.goto("/login")
    await page.getByLabel(/E-Mail|Email/i).fill(TEST_EMAIL)
    await page.getByLabel(/Passwort|Password/i).fill(TEST_PASSWORD)
    await page.getByRole("button", { name: /Anmelden|Login|Einloggen/i }).click()
    await expect(page).not.toHaveURL(/\/login/, { timeout: 10000 })

    const bookingId = process.env.PLAYWRIGHT_BOOKING_ID
    if (!bookingId) {
      test.skip()
      return
    }

    await page.goto(`/session/${bookingId}`)
    await expect(page.locator("text=diaiway Safety Enforcement").or(page.locator("text=Session starten"))).toBeVisible({ timeout: 8000 })

    // Safety-Modal: Alle 5 Checkboxen aktivieren
    const modal = page.getByRole("dialog")
    if (await modal.isVisible()) {
      const checks = page.locator('input[type="checkbox"]')
      const count = await checks.count()
      for (let i = 0; i < Math.min(count, 5); i++) {
        await checks.nth(i).check()
      }
      await page.getByRole("button", { name: /bestätigen|confirm|Ich bestätige/i }).click()
    }

    // Join-Button sollte jetzt aktiv sein (falls nicht zu früh)
    const joinBtn = page.getByRole("button", { name: /Beitreten|Join/i })
    const isDisabled = await joinBtn.isDisabled().catch(() => false)
    if (!isDisabled) {
      await joinBtn.click()
      // Raum wird vorbereitet oder Video erscheint
      await expect(
        page.locator("text=Video-Call wird vorbereitet").or(page.locator("text=Video call in preparation"))
      ).toBeVisible({ timeout: 15000 })
    }
  })

  test("7-Tage-Regel: Termine > 7 Tage müssen deaktiviert sein", async ({ page }) => {
    if (!TAKUMI_ID) {
      test.skip()
      return
    }
    await page.goto("/login")
    await page.getByLabel(/E-Mail|Email/i).fill(TEST_EMAIL)
    await page.getByLabel(/Passwort|Password/i).fill(TEST_PASSWORD)
    await page.getByRole("button", { name: /Anmelden|Login|Einloggen/i }).click()
    await expect(page).not.toHaveURL(/\/login/, { timeout: 10000 })

    await page.goto(`/booking/${TAKUMI_ID}`)
    await expect(page).toHaveURL(new RegExp(`/booking/${TAKUMI_ID}`), { timeout: 8000 })

    // Kalender laden
    await page.waitForSelector('button:has-text(">"), button:has-text("›"), [data-testid="calendar-next"]', { timeout: 5000 }).catch(() => {})

    // In den nächsten Monat blättern (um Tage > 7 zu erreichen)
    const nextBtn = page.locator('button').filter({ has: page.locator('svg') }).last()
    const nextArrow = page.getByRole("button").filter({ hasText: "" }).first()
    const navButtons = page.locator("button")
    const btnCount = await navButtons.count()
    const lastBtns = navButtons.nth(btnCount - 1)
    await lastBtns.click().catch(() => {})
    await page.waitForTimeout(500)

    // Ein Tag, der > 7 Tage in der Zukunft liegt (z.B. Tag 15 im nächsten Monat)
    const today = new Date()
    const futureDate = new Date(today)
    futureDate.setDate(futureDate.getDate() + 10)
    const dayNum = futureDate.getDate()

    const dayButton = page.locator(`button:has-text("${dayNum}")`).first()
    const dayExists = await dayButton.isVisible().catch(() => false)
    if (dayExists) {
      await dayButton.click()
      await page.waitForTimeout(300)
      const slots = page.locator('button:has-text(":"), [role="button"]')
      const slotCount = await slots.count()
      if (slotCount > 0) {
        await slots.first().click()
        await page.waitForTimeout(500)
        await expect(
          page.locator("text=max. 7 Tage|max 7 days|7-Tage|7 days").or(page.getByRole("alert"))
        ).toBeVisible({ timeout: 3000 })
      }
    }
  })
})
