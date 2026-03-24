import { prisma } from "@/lib/db"
import { sendPushToUser } from "@/lib/push"

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
  const waymail = await prisma.directMessage.create({
    data: {
      communicationType: "MAIL",
      senderId: null,
      senderDisplayName: "diAiway System",
      recipientId: opts.recipientId,
      subject: opts.subject,
      text: opts.body,
    },
  })

  // Zusätzlich Push + Notification für System-Waymail (best effort).
  // So bekommt der Nutzer auch außerhalb der App einen Hinweis auf neue Nachrichten.
  try {
    await prisma.notification.create({
      data: {
        userId: opts.recipientId,
        type: "new_message",
        bookingId: opts.bookingId ?? null,
        title: "Neue Waymail",
        body: (opts.subject || "").slice(0, 80),
      },
    })
  } catch {
    /* notification should not block */
  }

  sendPushToUser(opts.recipientId, {
    title: "Neue Waymail",
    body: (opts.subject || "").slice(0, 60),
    url: `/messages?waymail=${waymail.id}`,
  }).catch(() => {})

  return waymail
}
