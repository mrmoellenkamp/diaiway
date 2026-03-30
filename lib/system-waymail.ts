import { prisma } from "@/lib/db"

/**
 * Erstellt eine System-Waymail (Absender: "diAiway System").
 * Push-Notification und DB-Notification werden vom jeweiligen Aufrufer
 * mit dem passenden Typ und pushType gesetzt — nicht hier, um Dopplungen zu vermeiden.
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
  return waymail
}
