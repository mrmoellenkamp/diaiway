"use server"

import { stripe } from "@/lib/stripe"
import { prisma } from "@/lib/db"
import { sendBookingRequestEmail } from "@/lib/email"
import { sendPushToUser } from "@/lib/push"

export interface SessionCheckoutParams {
  bookingId: string
  takumiName: string
  duration: number // in minutes
  priceInCents: number
}

export interface BookingCheckoutParams {
  bookingId: string
  takumiName: string
  priceInCents: number
}

/** Create a Stripe Checkout Session for booking payment (Vorauszahlung). */
export async function startBookingCheckout(params: BookingCheckoutParams) {
  const { bookingId, takumiName, priceInCents } = params

  if (!bookingId || !priceInCents) {
    throw new Error("Missing required parameters for checkout")
  }

  const booking = await prisma.booking.findUnique({ where: { id: bookingId } })
  if (!booking) throw new Error("Booking not found")
  if (booking.paymentStatus === "paid") throw new Error("Buchung bereits bezahlt")

  const session = await stripe.checkout.sessions.create({
    ui_mode: "embedded",
    redirect_on_completion: "never",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "eur",
          product_data: {
            name: `Buchung Video-Session mit ${takumiName}`,
            description: `30 Minuten Beratung am ${booking.date} um ${booking.startTime} Uhr`,
          },
          unit_amount: priceInCents,
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    payment_intent_data: {
      capture_method: "manual", // Hold & Capture: Geld nur reservieren, erst bei Leistung einziehen
    },
    metadata: { bookingId, type: "booking_payment" },
  })

  await prisma.booking.update({
    where: { id: bookingId },
    data: { stripeSessionId: session.id, paymentStatus: "pending" },
  })

  return { clientSecret: session.client_secret, sessionId: session.id }
}

/** Create a Stripe Checkout Session for a video session payment (während des Calls). */
export async function startSessionCheckout(params: SessionCheckoutParams) {
  const { bookingId, takumiName, duration, priceInCents } = params

  if (!bookingId || !priceInCents) {
    throw new Error("Missing required parameters for checkout")
  }

  const booking = await prisma.booking.findUnique({ where: { id: bookingId } })
  if (!booking) throw new Error("Booking not found")
  if (booking.paymentStatus === "paid") throw new Error("Session already paid")

  const session = await stripe.checkout.sessions.create({
    ui_mode: "embedded",
    redirect_on_completion: "never",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "eur",
          product_data: {
            name: `Video-Session mit ${takumiName}`,
            description: `${duration} Minuten Beratung`,
          },
          unit_amount: priceInCents,
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    payment_intent_data: {
      capture_method: "manual", // Hold & Capture
    },
    metadata: { bookingId, type: "session_payment" },
  })

  await prisma.booking.update({
    where: { id: bookingId },
    data: { stripeSessionId: session.id, paymentStatus: "pending" },
  })

  return { clientSecret: session.client_secret, sessionId: session.id }
}

/** Verify payment status for a booking (client-side polling).
 * Prüft DB und bei pending zusätzlich Stripe direkt (Webhook kann verzögert sein).
 */
export async function verifySessionPayment(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      paymentStatus: true,
      paidAt: true,
      paidAmount: true,
      stripeSessionId: true,
    },
  })
  if (!booking) return { status: "error", message: "Booking not found" }

  if (booking.paymentStatus === "paid") {
    return {
      status: "paid" as const,
      paidAt: booking.paidAt,
      paidAmount: booking.paidAmount,
    }
  }

  // Bei pending: Stripe direkt prüfen (Webhook kann verzögert sein)
  if (booking.paymentStatus === "pending" && booking.stripeSessionId) {
    try {
      const session = await stripe.checkout.sessions.retrieve(booking.stripeSessionId)
      if (session.status === "complete" && session.payment_status === "paid") {
        const amountTotal = session.amount_total ?? 0
        await prisma.booking.update({
          where: { id: bookingId },
          data: {
            paymentStatus: "paid",
            stripePaymentIntentId: session.payment_intent as string,
            paidAt: new Date(),
            paidAmount: amountTotal,
          },
        })
        const { onPaymentReceived } = await import("@/lib/wallet-service")
        try {
          await onPaymentReceived(bookingId, amountTotal)
        } catch {
          /* Wallet-Update optional */
        }
        // E-Mail + Benachrichtigung an Takumi (falls Webhook nicht gefeuert hat)
        if (session.metadata?.type === "booking_payment") {
          try {
            const fullBooking = await prisma.booking.findUnique({
              where: { id: bookingId },
              include: { expert: true },
            })
            if (fullBooking) {
              const baseUrl =
                process.env.NEXTAUTH_URL ||
                (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
              const respondBase = `${baseUrl}/booking/respond/${fullBooking.id}?token=${fullBooking.statusToken}&action=confirmed`
              await sendBookingRequestEmail({
                to: fullBooking.expertEmail,
                takumiName: fullBooking.expertName,
                userName: fullBooking.userName,
                userEmail: fullBooking.userEmail,
                date: fullBooking.date,
                startTime: fullBooking.startTime,
                endTime: fullBooking.endTime,
                price: fullBooking.price,
                note: fullBooking.note || "",
                acceptUrl: `${respondBase.replace("action=confirmed", "")}&action=confirmed`,
                declineUrl: `${respondBase.replace("action=confirmed", "")}&action=declined`,
                askUrl: `${respondBase.replace("action=confirmed", "")}&action=ask`,
                dashboardUrl: `${baseUrl}/sessions`,
              })
              if (fullBooking.expert?.userId) {
                await prisma.notification.create({
                  data: {
                    userId: fullBooking.expert.userId,
                    type: "booking_request",
                    bookingId: fullBooking.id,
                    title: "Neue Buchungsanfrage (bezahlt)",
                    body: `${fullBooking.userName} hat eine Session am ${fullBooking.date} von ${fullBooking.startTime}–${fullBooking.endTime} Uhr gebucht und bezahlt.`,
                  },
                })
                sendPushToUser(fullBooking.expert.userId, {
                  title: "Neue Buchung (bezahlt)",
                  body: `${fullBooking.userName} hat am ${fullBooking.date} um ${fullBooking.startTime} Uhr gebucht.`,
                  url: "/sessions",
                }).catch(() => {})
              }
            }
          } catch (notifyErr) {
            console.error("[verifySessionPayment] Notification failed:", notifyErr)
          }
        }
        return {
          status: "paid" as const,
          paidAt: new Date(),
          paidAmount: amountTotal,
        }
      }
    } catch {
      /* Stripe-Abfrage fehlgeschlagen, DB-Status zurückgeben */
    }
  }

  return {
    status: booking.paymentStatus,
    paidAt: booking.paidAt,
    paidAmount: booking.paidAmount,
  }
}

/** Manual confirmation (called by webhook or after successful checkout). */
export async function confirmSessionPayment(
  stripeSessionId: string,
  paymentIntentId: string,
  amountPaid: number
) {
  const booking = await prisma.booking.updateMany({
    where: { stripeSessionId },
    data: {
      paymentStatus: "paid",
      stripePaymentIntentId: paymentIntentId,
      paidAt: new Date(),
      paidAmount: amountPaid,
    },
  })
  return booking
}
