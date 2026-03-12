"use server"

import { createSystemWaymail } from "@/lib/system-waymail"
import { getRenderedTemplate } from "@/lib/template-service"
import { seedCommunicationTemplates } from "@/lib/seed-templates"

const FALLBACK_SUBJECT = "Willkommen bei diAiway – Dein Start"
const baseUrl = process.env.NEXTAUTH_URL || "https://diaiway.com"
const FALLBACK_BODY = `Hallo!

Willkommen bei diAiway – deiner Plattform für Meisterwissen digital.

So startest du:

• **Experten finden**: Durchstöbere das Experten-Verzeichnis und finde Takumis für deine Themen.
• **Sessions buchen**: Wähle Video- oder Sprachanruf und buche direkt bei deinem Experten.
• **Chat & Waymails**: Chate live mit online Takumis oder sende formelle Waymails für Buchungs-Updates.

Experten-Verzeichnis: ${baseUrl}/takumis

Viel Erfolg auf deiner Reise!
Dein diAiway-Team`

/**
 * Sendet eine Willkommens-Waymail an einen neu registrierten User.
 * Nutzt das Template "welcome-mail" mit Fallback auf Hardcoded-Text.
 */
export async function sendWelcomeWaymail(userId: string): Promise<void> {
  try {
    let subject = FALLBACK_SUBJECT
    let body = FALLBACK_BODY

    const rendered = await getRenderedTemplate("welcome-mail", "de", {
      recipientUserId: userId,
      senderDisplayName: "diAiway System",
    })
    if (rendered) {
      subject = rendered.subject
      body = rendered.body
    } else {
      await seedCommunicationTemplates().catch(() => {})
      const retry = await getRenderedTemplate("welcome-mail", "de", {
        recipientUserId: userId,
        senderDisplayName: "diAiway System",
      })
      if (retry) {
        subject = retry.subject
        body = retry.body
      }
    }

    await createSystemWaymail({
      recipientId: userId,
      subject,
      body,
    })
  } catch (err) {
    console.error("[onboarding] Welcome-Waymail failed:", err)
  }
}
