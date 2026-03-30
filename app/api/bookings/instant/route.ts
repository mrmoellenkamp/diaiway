import { NextResponse } from "next/server"
import { randomBytes } from "crypto"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { ensureCustomerNumber } from "@/lib/billing"
import { isWithinInstantSlots } from "@/lib/availability-utils"
import { sendPushToUser } from "@/lib/push"
import { pushT } from "@/lib/push-strings"
import { getUserPreferredLocale } from "@/lib/user-preferred-locale"
import type { WeeklySlots } from "@/lib/availability-utils"
import { communicationUsername } from "@/lib/communication-display"
import { assertBookerPaymentVerified } from "@/lib/shugyo-payment-gate"
import { sendBookingRequestEmail } from "@/lib/email"

/**
 * POST /api/bookings/instant
 * Shugyo: Erstellt ein PENDING Instant-Booking für den Takumi (Anklopf).
 * Body: { expertId: string }
 */
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 })
  }

  const appRole = (session.user as { appRole?: string })?.appRole
  if (appRole !== "shugyo") {
    return NextResponse.json({ error: "Nur für Shugyo." }, { status: 403 })
  }

  const payGate = await assertBookerPaymentVerified(session.user.id)
  if (payGate) return payGate

  let body: { expertId?: string; callType?: "VIDEO" | "VOICE" }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Ungültiger Body." }, { status: 400 })
  }

  const expertId = body.expertId
  const callType = body.callType === "VOICE" ? "VOICE" : "VIDEO"
  if (!expertId || typeof expertId !== "string") {
    return NextResponse.json({ error: "expertId fehlt." }, { status: 400 })
  }

  try {
    const [expert, user] = await Promise.all([
      prisma.expert.findUnique({
        where: { id: expertId },
        select: {
          id: true,
          userId: true,
          name: true,
          email: true,
          liveStatus: true,
          priceVideo15Min: true,
          user: { select: { username: true } },
          priceVoice15Min: true,
          pricePerSession: true,
        },
      }),
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { name: true, username: true, email: true },
      }),
    ])

    if (!expert || !user) {
      return NextResponse.json({ error: "Experte oder Nutzer nicht gefunden." }, { status: 404 })
    }

    if (expert.liveStatus === "in_call") {
      return NextResponse.json(
        { error: "Takumi ist im Gespräch. Versuchen Sie es später noch einmal oder vereinbaren Sie einen Termin." },
        { status: 400 }
      )
    }
    if (expert.liveStatus !== "available") {
      return NextResponse.json(
        { error: "Takumi ist gerade nicht verfügbar. Bitte später erneut versuchen." },
        { status: 400 }
      )
    }

    const takumiUserId = expert.userId
    const availRow = takumiUserId
      ? await prisma.availability.findUnique({ where: { userId: takumiUserId } })
      : null
    const instantSlotsData = availRow?.instantSlots as WeeklySlots | null | undefined
    const hasInstantRestriction = instantSlotsData && Object.values(instantSlotsData).some((arr) => arr && arr.length > 0)
    if (hasInstantRestriction && !isWithinInstantSlots(instantSlotsData, new Date())) {
      return NextResponse.json(
        { error: "Instant-Calls sind außerhalb der angegebenen Sprechzeiten momentan nicht möglich." },
        { status: 400 }
      )
    }

    const today = new Date().toISOString().slice(0, 10)
    const now = new Date()
    const startTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`
    const endTime = `${String(now.getHours()).padStart(2, "0")}:${String((now.getMinutes() + 30) % 60).padStart(2, "0")}`

    const price15Min = Number(
      callType === "VOICE"
        ? (expert.priceVoice15Min ?? expert.priceVideo15Min ?? (expert.pricePerSession ? expert.pricePerSession / 2 : 0))
        : (expert.priceVideo15Min ?? (expert.pricePerSession ? expert.pricePerSession / 2 : 0))
    )
    const totalPrice = price15Min * 2 // 30 Min als Platzhalter

    const statusToken = randomBytes(24).toString("hex")
    await ensureCustomerNumber(session.user.id).catch((err) =>
      console.error("[bookings/instant] ensureCustomerNumber:", err)
    )
    const booking = await prisma.booking.create({
      data: {
        expertId: expert.id,
        expertName: expert.name,
        expertEmail: expert.email ?? "",
        userId: session.user.id,
        userName: communicationUsername((user as { username?: string | null }).username, "Shugyo"),
        userEmail: user.email ?? "",
        bookingMode: "instant",
        callType,
        date: today,
        startTime,
        endTime,
        status: "pending",
        totalPrice,
        statusToken,
      },
    })

    if (takumiUserId) {
      const tloc = await getUserPreferredLocale(takumiUserId)
      const userLabel = communicationUsername((user as { username?: string | null }).username, "Ein Nutzer")
      const pushTitle = pushT(tloc, "instantRequestTitle")
      const pushBody = pushT(tloc, "instantRequestBody", { userName: userLabel })

      // DB-Notification für Takumi (In-App-Glocke)
      prisma.notification.create({
        data: {
          userId: takumiUserId,
          type: "booking_request",
          bookingId: booking.id,
          title: pushTitle,
          body: pushBody,
        },
      }).catch(() => {})

      sendPushToUser(takumiUserId, {
        title: pushTitle,
        body: pushBody,
        url: `/session/${booking.id}`,
        tag: `instant-${booking.id}`,
        pushType: "BOOKING_REQUEST",
        data: {
          type: "BOOKING_REQUEST",
          bookingId: booking.id,
          statusToken,
        },
      }).catch(() => {})

      // E-Mail-Benachrichtigung an den Takumi (best effort)
      if (expert.email) {
        const baseUrl = process.env.NEXTAUTH_URL || "https://diaiway.com"
        sendBookingRequestEmail({
          to: expert.email,
          takumiName: communicationUsername(expert.user?.username, expert.name),
          userName: userLabel,
          userEmail: user.email ?? "",
          date: booking.date,
          startTime: booking.startTime,
          endTime: booking.endTime,
          price: Number(booking.totalPrice ?? 0),
          note: "",
          acceptUrl: `${baseUrl}/booking/respond/${booking.id}?token=${statusToken}&action=confirmed`,
          declineUrl: `${baseUrl}/booking/respond/${booking.id}?token=${statusToken}&action=declined`,
          askUrl: `${baseUrl}/booking/respond/${booking.id}?token=${statusToken}&action=ask`,
          dashboardUrl: `${baseUrl}/sessions`,
        }).catch(() => {})
      }
    }

    return NextResponse.json({
      ok: true,
      booking: {
        id: booking.id,
        status: booking.status,
        statusToken,
      },
    })
  } catch (err) {
    console.error("[bookings/instant] Error:", err)
    return NextResponse.json({ error: "Fehler beim Erstellen." }, { status: 500 })
  }
}
