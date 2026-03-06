import { NextResponse } from "next/server"
import { randomBytes } from "crypto"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { sendBookingRequestEmail } from "@/lib/email"

export const runtime = "nodejs"

function emailForName(name: string): string {
  const local = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "")
  return `${local || "expert"}@diaiway.test`
}

/** GET — list bookings for the current user (as booker or as expert) */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 })
  }

  try {
    // Find expert profile linked to this user (if any)
    const userExpert = await prisma.expert.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    })

    const bookings = await prisma.booking.findMany({
      where: {
        OR: [
          { userId: session.user.id },
          ...(userExpert ? [{ expertId: userExpert.id }] : []),
        ],
      },
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
        price: b.price,
        note: b.note,
        dailyRoomUrl: b.dailyRoomUrl,
        sessionStartedAt: b.sessionStartedAt,
        sessionEndedAt: b.sessionEndedAt,
        sessionDuration: b.sessionDuration,
        trialUsed: b.trialUsed,
        paymentStatus: b.paymentStatus,
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
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { takumiId, date, startTime, endTime, price, note } = body

    if (!takumiId || !date || !startTime || !endTime) {
      return NextResponse.json({ error: "Pflichtfelder fehlen." }, { status: 400 })
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
        price: price ?? expert.pricePerSession ?? 0,
        note: note || "",
        statusToken,
        paymentStatus: "unpaid",
        trialUsed: false,
      },
    })

    const baseUrl =
      process.env.NEXTAUTH_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")

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
        price: booking.price,
        note: note || "",
        acceptUrl: `${respondBase}&action=confirmed`,
        declineUrl: `${respondBase}&action=declined`,
        askUrl: `${respondBase}&action=ask`,
        dashboardUrl: `${baseUrl}/sessions`,
      })
    } catch (emailErr) {
      console.error("[Ionos SMTP] Failed to send booking request email:", emailErr)
    }

    return NextResponse.json({
      success: true,
      bookingId: booking.id,
      message: "Buchungsanfrage gesendet!",
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
