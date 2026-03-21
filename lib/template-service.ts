import { prisma } from "@/lib/db"
import { communicationUsername, waymailSenderLabel } from "@/lib/communication-display"

const ROLE_LABELS: Record<string, Record<string, string>> = {
  de: { takumi: "Takumi", shugyo: "Shugyo" },
  en: { takumi: "Takumi", shugyo: "Shugyo" },
  es: { takumi: "Takumi", shugyo: "Shugyo" },
}

export type TemplateCategory = "SYSTEM" | "BOOKING"
export type SupportedLanguage = "de" | "en" | "es"

export interface TemplateVariables {
  sender_name?: string
  recipient_name?: string
  sender_role?: string
  recipient_role?: string
  booking_date?: string
  service_name?: string
  /** Weitere benutzerdefinierte Variablen */
  [key: string]: string | undefined
}

/**
 * Rendert ein Template mit Variablen-Ersetzung.
 * Kommunikationsnamen nur per Username; Rollen-Labels für Personalisierung.
 */
export async function getRenderedTemplate(
  slug: string,
  language: SupportedLanguage,
  opts: {
    senderUserId?: string | null
    recipientUserId: string
    senderDisplayName?: string | null // z.B. "diAiway System"
    extraVariables?: Record<string, string>
  }
): Promise<{ subject: string; body: string } | null> {
  const [template, sender, recipient] = await Promise.all([
    prisma.communicationTemplate.findUnique({
      where: { slug },
      include: {
        translations: {
          where: { language },
          take: 1,
        },
      },
    }),
    opts.senderUserId
      ? prisma.user.findUnique({
          where: { id: opts.senderUserId },
          select: { username: true, appRole: true },
        })
      : null,
    prisma.user.findUnique({
      where: { id: opts.recipientUserId },
      select: { username: true, appRole: true },
    }),
  ])

  const translation = template?.translations[0]
  if (!translation) return null

  const labels = ROLE_LABELS[language] ?? ROLE_LABELS.de
  const senderName = waymailSenderLabel(
    opts.senderUserId ?? null,
    opts.senderDisplayName,
    sender?.username,
    "Unbekannt",
  )
  const recipientName = communicationUsername(recipient?.username, "Unbekannt")
  const senderRole = labels[(sender?.appRole as string) ?? "shugyo"] ?? "Shugyo"
  const recipientRole = labels[(recipient?.appRole as string) ?? "shugyo"] ?? "Shugyo"

  const vars: TemplateVariables = {
    sender_name: senderName,
    recipient_name: recipientName,
    sender_role: senderRole,
    recipient_role: recipientRole,
    ...opts.extraVariables,
  }

  const subject = replaceVariables(translation.subject ?? "", vars)
  const body = replaceVariables(translation.body, vars)
  return { subject, body }
}

function replaceVariables(text: string, vars: TemplateVariables): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const v = vars[key]
    return v !== undefined ? String(v) : `{{${key}}}`
  })
}

/** Standard-Variablen pro Kategorie (für Admin-Anzeige) */
export const STANDARD_VARIABLES = [
  "sender_name",
  "recipient_name",
  "sender_role",
  "recipient_role",
] as const

export const BOOKING_VARIABLES = [
  "booking_date",
  "service_name",
  "booking_time",
  "booking_note",
] as const
