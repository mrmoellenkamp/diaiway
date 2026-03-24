/**
 * Rollen-agnostischer Benachrichtigungs-Service.
 * Benachrichtigung + E-Mail + System-Waymail nach Buchungszahlung (Shugyo → Takumi).
 * Idempotent: erstellt keine doppelte booking_request Notification.
 */

import { prisma } from "@/lib/db"
import { sendBookingRequestEmail, sendBookingCancelledEmail } from "@/lib/email"
import { sendPushToUser } from "@/lib/push"
import { createSystemWaymail } from "@/lib/system-waymail"
import { getRenderedTemplate } from "@/lib/template-service"
import { seedCommunicationTemplates } from "@/lib/seed-templates"
import { communicationUsername } from "@/lib/communication-display"

export async function notifyAfterPayment(bookingId: string): Promise<{
  ok: boolean
  emailSent?: boolean
  notificationCreated?: boolean
  error?: string
}> {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        expert: { include: { user: { select: { username: true } } } },
        user: { select: { username: true } },
      },
    })

    if (!booking) {
      return { ok: false, error: "Booking not found" }
    }
    if (booking.paymentStatus !== "paid") {
      return { ok: false, error: "Booking not yet paid" }
    }

    const shugyoComm = communicationUsername(booking.user?.username, "Shugyo")
    const takumiComm = communicationUsername(booking.expert?.user?.username, "Takumi")

    const baseUrl =
      process.env.NEXTAUTH_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
    const respondBase = `${baseUrl}/booking/respond/${booking.id}?token=${booking.statusToken}`

    // Idempotenz-Gate: Wenn bereits booking_request für diese Buchung existiert,
    // keine zweite Anfrage-E-Mail senden (verhindert Doppelmails bei Polling/Webhook-Rennen).
    const existingRequestNotification = await prisma.notification.findFirst({
      where: { bookingId, type: "booking_request" },
      select: { id: true },
    })

    // E-Mail nur beim ersten Notify-Versuch senden
    let emailSent = false
    if (!existingRequestNotification) {
      try {
        await sendBookingRequestEmail({
          to: booking.expertEmail,
          takumiName: takumiComm,
          userName: shugyoComm,
          userEmail: booking.userEmail,
          date: booking.date,
          startTime: booking.startTime,
          endTime: booking.endTime,
          price: booking.price ?? 0,
          note: booking.note || "",
          acceptUrl: `${respondBase}&action=confirmed`,
          declineUrl: `${respondBase}&action=declined`,
          askUrl: `${respondBase}&action=ask`,
          dashboardUrl: `${baseUrl}/sessions`,
        })
        emailSent = true
      } catch (emailErr) {
        console.error("[notification-service] Email failed:", emailErr)
      }
    }

    let notifyUserId = booking.expert?.userId ?? null
    if (!notifyUserId && booking.expertEmail) {
      const user = await prisma.user.findFirst({
        where: { email: { equals: booking.expertEmail, mode: "insensitive" } },
        select: { id: true },
      })
      if (user) notifyUserId = user.id
    }

    let notificationCreated = false
    if (notifyUserId) {
      const existing = existingRequestNotification ?? (await prisma.notification.findFirst({
        where: { bookingId, type: "booking_request", userId: notifyUserId },
      }))
      if (!existing) {
        const bookingTime = `${booking.startTime}–${booking.endTime} Uhr`
        let waymailSubject = "Neue Buchungsanfrage (bezahlt)"
        let waymailBody = `${shugyoComm} hat eine Session am ${booking.date} von ${bookingTime} gebucht und bezahlt.`

        const rendered = await getRenderedTemplate("booking-request-paid", "de", {
          senderUserId: booking.userId,
          recipientUserId: notifyUserId,
          extraVariables: {
            booking_date: booking.date,
            booking_time: bookingTime,
            service_name: takumiComm,
          },
        })
        if (rendered) {
          waymailSubject = rendered.subject
          waymailBody = rendered.body
        } else {
          await seedCommunicationTemplates().catch(() => {})
          const retry = await getRenderedTemplate("booking-request-paid", "de", {
            senderUserId: booking.userId,
            recipientUserId: notifyUserId,
            extraVariables: {
              booking_date: booking.date,
              booking_time: bookingTime,
              service_name: takumiComm,
            },
          })
          if (retry) {
            waymailSubject = retry.subject
            waymailBody = retry.body
          }
        }

        await prisma.notification.create({
          data: {
            userId: notifyUserId,
            type: "booking_request",
            bookingId: booking.id,
            title: waymailSubject,
            body: waymailBody,
          },
        })
        const waymail = await createSystemWaymail({
          recipientId: notifyUserId,
          subject: waymailSubject,
          body: waymailBody,
        }).catch(() => null)
        notificationCreated = true
        const waymailUrl = waymail ? `${baseUrl}/messages?waymail=${waymail.id}` : `${baseUrl}/messages`
        sendPushToUser(notifyUserId, {
          title: "Neue Buchung (bezahlt)",
          body: `${shugyoComm} hat am ${booking.date} um ${booking.startTime} Uhr gebucht.`,
          url: waymailUrl,
        }).catch(() => {})
      }
    } else {
      console.warn("[notification-service] Expert ohne userId:", booking.expertEmail)
    }

    return { ok: true, emailSent, notificationCreated }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown"
    console.error("[notification-service] Error:", msg)
    return { ok: false, error: msg }
  }
}

/** @deprecated Use notifyAfterPayment. Alias für Abwärtskompatibilität. */
export const notifyTakumiAfterPayment = notifyAfterPayment

/**
 * Benachrichtigt die ANDERE Partei wenn eine Buchung storniert wird.
 * cancelledBy: "expert" → Shugyo wird benachrichtigt; "user" → Takumi wird benachrichtigt.
 */
export async function notifyAfterCancellation(opts: {
  bookingId: string
  cancelledBy: "expert" | "user"
  expertUserId: string | null
  expertEmail: string
  expertName: string
  userId: string
  userEmail: string
  userName: string
  date: string
  startTime: string
  endTime: string
  refundAmount?: number
}): Promise<void> {
  const baseUrl =
    process.env.NEXTAUTH_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")

  const notifyExpert = opts.cancelledBy === "user"
  const recipientUserId = notifyExpert ? opts.expertUserId : opts.userId
  const recipientEmail = notifyExpert ? opts.expertEmail : opts.userEmail
  const recipientName = notifyExpert ? opts.expertName : opts.userName
  const cancelledByName = notifyExpert ? opts.userName : opts.expertName
  const cancelledByRole = opts.cancelledBy === "user" ? "shugyo" : "takumi"

  // Email
  try {
    await sendBookingCancelledEmail({
      to: recipientEmail,
      recipientName,
      cancelledByName,
      cancelledByRole,
      date: opts.date,
      startTime: opts.startTime,
      endTime: opts.endTime,
      refundAmount: opts.refundAmount,
    })
  } catch (err) {
    console.error("[notification-service] Cancel email failed:", err)
  }

  if (!recipientUserId) return

  const title = "Buchung storniert"
  const body = `Deine Buchung am ${opts.date} um ${opts.startTime} Uhr wurde von ${cancelledByName} storniert.`

  // In-App Notification
  try {
    await prisma.notification.create({
      data: { userId: recipientUserId, type: "booking_cancelled", bookingId: opts.bookingId, title, body },
    })
  } catch (err) {
    console.error("[notification-service] Cancel notification DB failed:", err)
  }

  // Waymail
  try {
    const waymail = await createSystemWaymail({ recipientId: recipientUserId, subject: title, body })
    const waymailUrl = waymail ? `${baseUrl}/messages?waymail=${waymail.id}` : `${baseUrl}/sessions`
    sendPushToUser(recipientUserId, { title, body, url: waymailUrl }).catch(() => {})
  } catch (err) {
    console.error("[notification-service] Cancel waymail/push failed:", err)
  }
}
