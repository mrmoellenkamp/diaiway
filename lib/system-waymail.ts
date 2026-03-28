import { prisma } from "@/lib/db"
import { sendPushToUser } from "@/lib/push"
import { pushT } from "@/lib/push-strings"
import { getUserPreferredLocale } from "@/lib/user-preferred-locale"

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
  const loc = await getUserPreferredLocale(opts.recipientId)
  const waymailPushTitle = pushT(loc, "newWaymailTitle")

  try {
    await prisma.notification.create({
      data: {
        userId: opts.recipientId,
        type: "new_message",
        bookingId: opts.bookingId ?? null,
        title: waymailPushTitle,
        body: (opts.subject || "").slice(0, 80),
      },
    })
  } catch {
    /* notification should not block */
  }

  sendPushToUser(opts.recipientId, {
    title: waymailPushTitle,
    body: (opts.subject || "").slice(0, 60),
    url: `/messages?waymail=${waymail.id}`,
  }).catch(() => {})

  return waymail
}
