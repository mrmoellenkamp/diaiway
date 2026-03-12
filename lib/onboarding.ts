"use server"

import { createSystemWaymail } from "@/lib/system-waymail"

const baseUrl = process.env.NEXTAUTH_URL || "https://diaiway.com"
const expertsUrl = `${baseUrl}/takumis`

const WELCOME_SUBJECT = "Willkommen bei diAiway – Dein Start"

const WELCOME_BODY = `Hallo!

Willkommen bei diAiway – deiner Plattform für Meisterwissen digital.

So startest du:

• **Experten finden**: Durchstöbere das Experten-Verzeichnis und finde Takumis für deine Themen.
• **Sessions buchen**: Wähle Video- oder Sprachanruf und buche direkt bei deinem Experten.
• **Chat & Waymails**: Chate live mit online Takumis oder sende formelle Waymails für Buchungs-Updates.

Experten-Verzeichnis: ${expertsUrl}

Viel Erfolg auf deiner Reise!
Dein diAiway-Team`

/**
 * Sendet eine Willkommens-Waymail an einen neu registrierten User.
 * Wird direkt nach der Kontoerstellung aufgerufen.
 */
export async function sendWelcomeWaymail(userId: string): Promise<void> {
  try {
    await createSystemWaymail({
      recipientId: userId,
      subject: WELCOME_SUBJECT,
      body: WELCOME_BODY,
    })
  } catch (err) {
    console.error("[onboarding] Welcome-Waymail failed:", err)
  }
}
