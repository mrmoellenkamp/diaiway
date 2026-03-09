"use server"

import { stripe } from "@/lib/stripe"
import { prisma } from "@/lib/db"
import { notifyTakumiAfterPayment } from "@/lib/notify-takumi"

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

  const serviceLabel = "Expertensitzung"
  const durationMin = (() => {
    if (booking.startTime && booking.endTime) {
      const [sh, sm] = booking.startTime.split(":").map(Number)
      const [eh, em] = booking.endTime.split(":").map(Number)
      return (eh * 60 + em) - (sh * 60 + sm)
    }
    return 30
  })()

  const session = await stripe.checkout.sessions.create({
    ui_mode: "embedded",
    redirect_on_completion: "never",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "eur",
          product_data: {
            name: `Buchung ${serviceLabel} mit ${takumiName}`,
            description: `${durationMin} Minuten Beratung am ${booking.date} um ${booking.startTime} Uhr`,
          },
          unit_amount: priceInCents,
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    payment_intent_data: {
      capture_method: "manual", // Hold & Capture: Geld nur reservieren, erst bei Leistung einziehen
      metadata: { bookingId, type: "booking_payment" }, // Für amount_capturable_updated-Webhook
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

  const serviceLabel = "Expertensitzung"

  const session = await stripe.checkout.sessions.create({
    ui_mode: "embedded",
    redirect_on_completion: "never",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "eur",
          product_data: {
            name: `${serviceLabel} mit ${takumiName}`,
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
      metadata: { bookingId, type: "session_payment" }, // Für amount_capturable_updated-Webhook
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
  // Bei manual capture: payment_status = "unpaid" (nur autorisiert, noch nicht eingezogen)
  if (booking.paymentStatus === "pending" && booking.stripeSessionId) {
    try {
      const session = await stripe.checkout.sessions.retrieve(booking.stripeSessionId)
      const isPaidOrAuthorized =
        session.status === "complete" &&
        (session.payment_status === "paid" || session.payment_status === "unpaid")
      if (isPaidOrAuthorized) {
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
            await notifyTakumiAfterPayment(bookingId)
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
