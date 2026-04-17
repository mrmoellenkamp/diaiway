import { NextResponse } from "next/server"
import { randomBytes } from "crypto"
import { prisma } from "@/lib/db"
import { Prisma } from "@prisma/client"
import { ensureCustomerNumber } from "@/lib/billing"
import { sendBookingRequestEmail } from "@/lib/email"
import { sendPushToUser } from "@/lib/push"
import { pushT } from "@/lib/push-strings"
import { getUserPreferredLocale } from "@/lib/user-preferred-locale"
import { createSystemWaymail } from "@/lib/system-waymail"
import { validateBookingDateWindow } from "@/lib/booking-date-validation"
import { emailForName } from "@/lib/email-utils"
import { requireAuth } from "@/lib/api-auth"
import { apiHandler } from "@/lib/api-handler"
import { runBookingListHousekeeping } from "@/lib/booking-housekeeping"
import { communicationUsername } from "@/lib/communication-display"
import { assertBookerPaymentVerified } from "@/lib/shugyo-payment-gate"
import { assertRateLimit } from "@/lib/api-rate-limit"
import { createBookingSchema } from "@/lib/schemas/bookings"
import { logSecureError } from "@/lib/log-redact"

export const runtime = "nodejs"

/** GET — list bookings for the current user (as booker or as expert)
 * Query: view=takumi — only bookings where user is the expert (for availability dashboard)
 *        view=shugyo — only bookings where user is the booker (default: both)
 */
export const GET = apiHandler(async (req) => {
  const authResult = await requireAuth()
  if (authResult.response) return authResult.response
  const { session } = authResult

  void runBookingListHousekeeping().catch(() => {})

  const { searchParams } = new URL(req.url)
  const view = searchParams.get("view")

  const userExpert = await prisma.expert.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  })

  let whereClause: { userId?: string; expertId?: string | { in: string[] }; OR?: Array<{ userId: string } | { expertId: string }> }
  if (view === "takumi" && userExpert) {
    whereClause = { expertId: userExpert.id }
  } else if (view === "takumi" && !userExpert) {
    whereClause = { expertId: { in: [] } }
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
    include: {
      expert: {
        select: {
          avatar: true,
          imageUrl: true,
          subcategory: true,
          user: { select: { username: true } },
        },
      },
      user: { select: { username: true, image: true } },
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }, { createdAt: "desc" }],
  })

  return NextResponse.json({
    bookings: bookings.map((b) => ({
      id: b.id,
      expertId: b.expertId,
      expertName: b.expertName,
      expertEmail: b.expertEmail,
      takumiId: b.expertId,
      takumiName: communicationUsername(b.expert?.user?.username, "Takumi"),
      takumiEmail: b.expertEmail,
      takumiAvatar: b.expert?.avatar || "",
      takumiImageUrl: b.expert?.imageUrl || "",
      takumiSubcategory: b.expert?.subcategory || "",
      userId: b.userId,
      userName: communicationUsername(b.user?.username, "Shugyo"),
      userEmail: b.userEmail,
      userImageUrl: b.user?.image || "",
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
      bookingMode: b.bookingMode,
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
})

/** POST — create a new booking (status: pending) */
export const POST = apiHandler(async (req) => {
  const authResult = await requireAuth()
  if (authResult.response) return authResult.response
  const { session } = authResult

  // Rate-Limit: 30 Buchungen/Stunde pro Nutzer + IP.
  // Gängige "Normal-User" buchen weit darunter; Bots werden so gebremst.
  const rl = await assertRateLimit(
    { req, userId: session.user.id },
    { bucket: "bookings:create", limit: 30, windowSec: 3600 }
  )
  if (rl) return rl

  const appRole = (session.user as { appRole?: string }).appRole
  if (appRole === "shugyo") {
    const gate = await assertBookerPaymentVerified(session.user.id)
    if (gate) return gate
  }

  const idempotencyKey = req.headers.get("X-Idempotency-Key")
  if (idempotencyKey) {
    const existing = await prisma.booking.findFirst({
      where: { idempotencyKey, userId: session.user.id },
      select: { id: true },
    })
    if (existing) {
      return NextResponse.json({
        success: true,
        bookingId: existing.id,
        deferNotification: false,
        message: "Buchung bereits erstellt.",
      }, { status: 200 })
    }
  }

  // Eingaben strikt validieren (ZodError → 400 via apiHandler).
  const raw = await req.json()
  const parsed = createBookingSchema.parse(raw)
  const { takumiId, date, startTime, endTime, callType, note, deferNotification } = parsed
  const effectiveCallType = callType ?? "VIDEO"

  const [sh, sm] = startTime.split(":").map(Number)
  const [eh, em] = endTime.split(":").map(Number)
  const durationMin = (eh * 60 + em) - (sh * 60 + sm)
  if (durationMin < 15 || durationMin % 15 !== 0) {
    return NextResponse.json({ error: "Mindestdauer 15 Minuten, nur Vielfache von 15 möglich." }, { status: 400 })
  }

  const dateValidation = validateBookingDateWindow(date, startTime)
  if (!dateValidation.valid) {
    return NextResponse.json(
      { error: dateValidation.message },
      { status: 400 }
    )
  }

  const expert = await prisma.expert.findUnique({
    where: { id: takumiId },
    include: { user: { select: { username: true } } },
  })
  const takumiCommName = communicationUsername(expert?.user?.username, "Takumi")
  const shugyoCommName = communicationUsername((session.user as { username?: string | null }).username, "Shugyo")
  if (!expert) {
    return NextResponse.json({ error: "Experte nicht gefunden." }, { status: 404 })
  }

  if (expert.userId === session.user.id) {
    return NextResponse.json({ error: "Du kannst dich nicht selbst buchen." }, { status: 400 })
  }

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

  // SECURITY: Preis wird AUSSCHLIESSLICH serverseitig berechnet.
  // Client-Werte `totalPrice`/`price` aus dem Request werden ignoriert
  // (Schutz gegen Preis-Manipulation via DevTools / manipuliertem Client).
  const perQuarterPriceCents = (() => {
    const video = Number(expert.priceVideo15Min || 0)
    const voice = Number(expert.priceVoice15Min || 0)
    if (effectiveCallType === "VOICE" && voice > 0) return voice
    if (effectiveCallType === "VIDEO" && video > 0) return video
    return video || voice || (expert.pricePerSession ? expert.pricePerSession / 2 : 0)
  })()
  const quarters = Math.max(1, Math.round(durationMin / 15))
  const serverTotalPrice = Math.max(0, Number(perQuarterPriceCents) * quarters)
  const serverPrice = Math.round(serverTotalPrice)

  const statusToken = randomBytes(32).toString("hex")

  await ensureCustomerNumber(session.user.id).catch((err) =>
    logSecureError("bookings.POST.ensureCustomerNumber", err)
  )

  const booking = await prisma.$transaction(
    async (tx) => {
      const conflict = await tx.booking.findFirst({
        where: {
          expertId: takumiId,
          date,
          status: { in: ["pending", "confirmed", "active"] },
          AND: [{ startTime: { lt: endTime } }, { endTime: { gt: startTime } }],
        },
      })
      if (conflict) {
        throw new Error("SLOT_CONFLICT")
      }

      return tx.booking.create({
        data: {
          expertId: takumiId,
          expertName: expert.name,
          expertEmail,
          userId: session.user.id,
          userName: shugyoCommName,
          userEmail: session.user.email || "",
          date,
          startTime,
          endTime,
          callType: effectiveCallType,
          totalPrice: serverTotalPrice,
          price: serverPrice,
          note: note || "",
          statusToken,
          idempotencyKey: idempotencyKey || undefined,
          paymentStatus: "unpaid",
          trialUsed: false,
        },
      })
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  )

  const baseUrl =
    process.env.NEXTAUTH_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")

  if (!deferNotification) {
    try {
      const respondBase = `${baseUrl}/booking/respond/${booking.id}?token=${statusToken}`
      await sendBookingRequestEmail({
        to: expertEmail,
        takumiName: takumiCommName,
        userName: shugyoCommName,
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
      logSecureError("bookings.POST.email", emailErr)
    }

    if (expert.userId) {
      try {
        const eloc = await getUserPreferredLocale(expert.userId)
        const timeRange = `${startTime}–${endTime}`
        const brTitle = pushT(eloc, "bookingRequestUnpaidTitle")
        const brBody = pushT(eloc, "bookingRequestUnpaidBody", {
          shugyoName: shugyoCommName,
          date,
          timeRange,
        })
        await prisma.notification.create({
          data: {
            userId: expert.userId,
            type: "booking_request",
            bookingId: booking.id,
            title: brTitle,
            body: brBody,
          },
        })
        const waymail = await createSystemWaymail({
          recipientId: expert.userId,
          subject: brTitle,
          body: brBody,
        }).catch(() => null)
        const waymailUrl = waymail ? `${baseUrl}/messages?waymail=${waymail.id}` : `${baseUrl}/messages`
        sendPushToUser(expert.userId, {
          title: brTitle,
          body: brBody,
          url: waymailUrl,
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
})
