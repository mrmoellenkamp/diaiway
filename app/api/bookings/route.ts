import { NextResponse } from "next/server"
import { randomBytes } from "crypto"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { sendBookingRequestEmail } from "@/lib/email"
import { sendPushToUser } from "@/lib/push"
import { parseBerlinDateTime, isBeyondMaxBookingDays } from "@/lib/date-utils"
import { emailForName } from "@/lib/email-utils"
import { requireAuth } from "@/lib/api-auth"

export const runtime = "nodejs"

/** GET — list bookings for the current user (as booker or as expert)
 * Query: view=takumi — only bookings where user is the expert (for availability dashboard)
 *        view=shugyo — only bookings where user is the booker (default: both)
 */
export async function GET(req: Request) {
  const authResult = await requireAuth()
  if (authResult.response) return authResult.response
  const { session } = authResult

  const { searchParams } = new URL(req.url)
  const view = searchParams.get("view")

  try {
    // Find expert profile linked to this user (if any)
    const userExpert = await prisma.expert.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    })

    let whereClause: { userId?: string; expertId?: string | { in: string[] }; OR?: Array<{ userId: string } | { expertId: string }> }
    if (view === "takumi" && userExpert) {
      whereClause = { expertId: userExpert.id }
    } else if (view === "takumi" && !userExpert) {
      whereClause = { expertId: { in: [] } }  // no expert → no takumi bookings (leere Liste = 0 Treffer)
    } else if (view === "shugyo") {
      whereClause = { userId: session.user.id }
    } else {
      whereClause = {
        OR: [
          { userId: session.user.id },
          ...(userExpert ? [{ expertId: userExpert.id }] : []),
        ],
      }
    }

    const bookings = await prisma.booking.findMany({
      where: whereClause,
      include: { expert: { select: { avatar: true, subcategory: true } } },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({
      bookings: bookings.map((b) => ({
        id: b.id,
        expertId: b.expertId,
        expertName: b.expertName,
        expertEmail: b.expertEmail,
        // Legacy aliases for frontend compatibility
        takumiId: b.expertId,
        takumiName: b.expertName,
        takumiEmail: b.expertEmail,
        takumiAvatar: b.expert?.avatar || "",
        takumiSubcategory: b.expert?.subcategory || "",
        userId: b.userId,
        userName: b.userName,
        userEmail: b.userEmail,
        date: b.date,
        startTime: b.startTime,
        endTime: b.endTime,
        status: b.status,
        callType: b.callType,
        totalPrice: b.totalPrice != null ? Number(b.totalPrice) : null,
        price: b.price,
        note: b.note,
        sessionStartedAt: b.sessionStartedAt,
        sessionEndedAt: b.sessionEndedAt,
        sessionDuration: b.sessionDuration,
        trialUsed: b.trialUsed,
        paymentStatus: b.paymentStatus,
        statusToken: b.statusToken,
        stripeSessionId: b.stripeSessionId,
        stripePaymentIntentId: b.stripePaymentIntentId,
        paidAt: b.paidAt,
        paidAmount: b.paidAmount,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
      })),
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

/** POST — create a new booking (status: pending) */
export async function POST(req: Request) {
  const authResult = await requireAuth()
  if (authResult.response) return authResult.response
  const { session } = authResult

  try {
    const body = await req.json()
    const { takumiId, date, startTime, endTime, callType, totalPrice, price, note, deferNotification } = body

    // callType: VIDEO | VOICE, Default VIDEO
    if (callType != null && callType !== "VIDEO" && callType !== "VOICE") {
      return NextResponse.json({
        error: "callType muss 'VIDEO' oder 'VOICE' sein.",
      }, { status: 400 })
    }
    const effectiveCallType = callType === "VIDEO" || callType === "VOICE" ? callType : "VIDEO"

    if (!takumiId || !date || !startTime || !endTime) {
      return NextResponse.json({ error: "Pflichtfelder fehlen." }, { status: 400 })
    }

    const [sh, sm] = startTime.split(":").map(Number)
    const [eh, em] = endTime.split(":").map(Number)
    const durationMin = (eh * 60 + em) - (sh * 60 + sm)
    if (durationMin < 15 || durationMin % 15 !== 0) {
      return NextResponse.json({ error: "Mindestdauer 15 Minuten, nur Vielfache von 15 möglich." }, { status: 400 })
    }

    // Reject bookings in the past (Berlin time)
    const slotDateTime = parseBerlinDateTime(date, startTime)
    if (slotDateTime <= new Date()) {
      return NextResponse.json({ error: "Buchungen in der Vergangenheit sind nicht möglich." }, { status: 400 })
    }

    // 7-Tage-Regel: Buchungen max. 7 Tage im Voraus
    if (isBeyondMaxBookingDays(date, startTime)) {
      return NextResponse.json({ error: "Buchungen dürfen maximal 7 Tage im Voraus getätigt werden." }, { status: 400 })
    }

    // Load expert
    const expert = await prisma.expert.findUnique({ where: { id: takumiId } })
    if (!expert) {
      return NextResponse.json({ error: "Experte nicht gefunden." }, { status: 404 })
    }

    // Prevent self-booking
    if (expert.userId === session.user.id) {
      return NextResponse.json({ error: "Du kannst dich nicht selbst buchen." }, { status: 400 })
    }

    // Resolve expert email
    let expertEmail = expert.email?.trim() || ""
    if (!expertEmail && expert.userId) {
      const linkedUser = await prisma.user.findUnique({
        where: { id: expert.userId },
        select: { email: true },
      })
      if (linkedUser?.email) expertEmail = linkedUser.email
    }
    if (!expertEmail) {
      expertEmail = emailForName(expert.name)
      await prisma.expert.update({ where: { id: expert.id }, data: { email: expertEmail } })
    }

    // Check time-slot conflict
    const conflict = await prisma.booking.findFirst({
      where: {
        expertId: takumiId,
        date,
        status: { in: ["pending", "confirmed", "active"] },
        AND: [{ startTime: { lt: endTime } }, { endTime: { gt: startTime } }],
      },
    })
    if (conflict) {
      return NextResponse.json({ error: "Dieser Zeitraum ist bereits belegt." }, { status: 409 })
    }

    const effectiveTotalPrice = totalPrice != null && totalPrice >= 1
      ? totalPrice
      : (price ?? (Number(expert.priceVideo15Min) || (expert.pricePerSession ? expert.pricePerSession / 2 : 0)) * (durationMin / 15))

    const statusToken = randomBytes(32).toString("hex")
    const booking = await prisma.booking.create({
      data: {
        expertId: takumiId,
        expertName: expert.name,
        expertEmail,
        userId: session.user.id,
        userName: session.user.name || "Nutzer",
        userEmail: session.user.email || "",
        date,
        startTime,
        endTime,
        callType: effectiveCallType,
        totalPrice: effectiveTotalPrice,
        price: price ?? Math.round(effectiveTotalPrice),
        note: note || "",
        statusToken,
        paymentStatus: "unpaid",
        trialUsed: false,
      },
    })

    const baseUrl =
      process.env.NEXTAUTH_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")

    // E-Mail + Notification: erst nach Vorautorisierung (im Webhook / pay-with-wallet)
    if (!deferNotification) {
      try {
        const respondBase = `${baseUrl}/booking/respond/${booking.id}?token=${statusToken}`
        await sendBookingRequestEmail({
          to: expertEmail,
          takumiName: expert.name,
          userName: session.user.name || "Nutzer",
          userEmail: session.user.email || "",
          date,
          startTime,
          endTime,
          price: Number(booking.totalPrice ?? booking.price ?? 0),
          note: note || "",
          acceptUrl: `${respondBase}&action=confirmed`,
          declineUrl: `${respondBase}&action=declined`,
          askUrl: `${respondBase}&action=ask`,
          dashboardUrl: `${baseUrl}/sessions`,
        })
      } catch (emailErr) {
        console.error("[Ionos SMTP] Failed to send booking request email:", emailErr)
      }

      if (expert.userId) {
        try {
          await prisma.notification.create({
            data: {
              userId: expert.userId,
              type: "booking_request",
              bookingId: booking.id,
              title: "Neue Buchungsanfrage",
              body: `${session.user.name || "Ein Nutzer"} möchte am ${date} von ${startTime}–${endTime} Uhr buchen.`,
            },
          })
          sendPushToUser(expert.userId, {
            title: "Neue Buchungsanfrage",
            body: `${session.user.name || "Ein Nutzer"} möchte am ${date} von ${startTime}–${endTime} Uhr buchen.`,
            url: "/messages",
          }).catch(() => {})
        } catch { /* notification errors must not block */ }
      }
    }

    return NextResponse.json({
      success: true,
      bookingId: booking.id,
      deferNotification: !!deferNotification,
      message: deferNotification ? "Buchung erstellt. Bitte zahle jetzt." : "Buchungsanfrage gesendet!",
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
