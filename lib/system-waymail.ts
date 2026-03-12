import { prisma } from "@/lib/db"

/**
 * Erstellt eine System-Waymail (Absender: "diAiway System").
 * Wird für Buchungsanfragen, Status-Änderungen etc. verwendet.
 */
export async function createSystemWaymail(opts: {
  recipientId: string
  subject: string
  body: string
  bookingId?: string | null
}) {
  return prisma.directMessage.create({
    data: {
      communicationType: "MAIL",
      senderId: null,
      senderDisplayName: "diAiway System",
      recipientId: opts.recipientId,
      subject: opts.subject,
      text: opts.body,
    },
  })
}
