/**
 * Rollen-agnostischer Benachrichtigungs-Service.
 * Benachrichtigung + E-Mail + System-Waymail nach Buchungszahlung (Shugyo → Takumi).
 * Idempotent: erstellt keine doppelte booking_request Notification.
 */

import { prisma } from "@/lib/db"
import { sendBookingRequestEmail } from "@/lib/email"
import { sendPushToUser } from "@/lib/push"
import { createSystemWaymail } from "@/lib/system-waymail"
import { getRenderedTemplate } from "@/lib/template-service"
import { seedCommunicationTemplates } from "@/lib/seed-templates"

export async function notifyAfterPayment(bookingId: string): Promise<{
  ok: boolean
  emailSent?: boolean
  notificationCreated?: boolean
  error?: string
}> {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { expert: true },
    })

    if (!booking) {
      return { ok: false, error: "Booking not found" }
    }
    if (booking.paymentStatus !== "paid") {
      return { ok: false, error: "Booking not yet paid" }
    }

    const baseUrl =
      process.env.NEXTAUTH_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
    const respondBase = `${baseUrl}/booking/respond/${booking.id}?token=${booking.statusToken}&action=confirmed`

    // E-Mail (immer senden)
    let emailSent = false
    try {
      await sendBookingRequestEmail({
        to: booking.expertEmail,
        takumiName: booking.expertName,
        userName: booking.userName,
        userEmail: booking.userEmail,
        date: booking.date,
        startTime: booking.startTime,
        endTime: booking.endTime,
        price: booking.price ?? 0,
        note: booking.note || "",
        acceptUrl: `${respondBase.replace("action=confirmed", "")}&action=confirmed`,
        declineUrl: `${respondBase.replace("action=confirmed", "")}&action=declined`,
        askUrl: `${respondBase.replace("action=confirmed", "")}&action=ask`,
        dashboardUrl: `${baseUrl}/sessions`,
      })
      emailSent = true
    } catch (emailErr) {
      console.error("[notification-service] Email failed:", emailErr)
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
      const existing = await prisma.notification.findFirst({
        where: { bookingId, type: "booking_request", userId: notifyUserId },
      })
      if (!existing) {
        const bookingTime = `${booking.startTime}–${booking.endTime} Uhr`
        let waymailSubject = "Neue Buchungsanfrage (bezahlt)"
        let waymailBody = `${booking.userName} hat eine Session am ${booking.date} von ${bookingTime} gebucht und bezahlt.`

        const rendered = await getRenderedTemplate("booking-request-paid", "de", {
          senderUserId: booking.userId,
          recipientUserId: notifyUserId,
          extraVariables: {
            booking_date: booking.date,
            booking_time: bookingTime,
            service_name: booking.expertName,
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
              service_name: booking.expertName,
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
        sendPushToUser(notifyUserId, {
          title: "Neue Buchung (bezahlt)",
          body: `${booking.userName} hat am ${booking.date} um ${booking.startTime} Uhr gebucht.`,
          url: waymail ? `/messages?waymail=${waymail.id}` : "/messages",
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
