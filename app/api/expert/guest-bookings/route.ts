import { NextResponse } from "next/server"
import { randomBytes } from "crypto"
import { randomUUID } from "crypto"
import { prisma } from "@/lib/db"
import { requireAuth } from "@/lib/api-auth"
import { apiHandler } from "@/lib/api-handler"

export const runtime = "nodejs"

/**
 * POST — Takumi creates a guest booking (no registered user required).
 * Body: { guestEmail, date, startTime, endTime, callType?, totalPrice?, note? }
 *
 * Returns the booking incl. guestToken (used to generate the public /call/[guestToken] link).
 */
export const POST = apiHandler(async (req) => {
  const authResult = await requireAuth()
  if (authResult.response) return authResult.response
  const { session } = authResult

  const body = await req.json()
  const { guestEmail, date, startTime, endTime, callType, totalPrice, note } = body

  if (!guestEmail || !date || !startTime || !endTime) {
    return NextResponse.json({ error: "Pflichtfelder fehlen: guestEmail, date, startTime, endTime." }, { status: 400 })
  }

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRe.test(guestEmail)) {
    return NextResponse.json({ error: "Ungültige E-Mail-Adresse für den Gast." }, { status: 400 })
  }

  const effectiveCallType = callType === "VOICE" ? "VOICE" : "VIDEO"

  const [sh, sm] = startTime.split(":").map(Number)
  const [eh, em] = endTime.split(":").map(Number)
  const durationMin = (eh * 60 + em) - (sh * 60 + sm)
  if (durationMin < 15 || durationMin % 15 !== 0) {
    return NextResponse.json({ error: "Mindestdauer 15 Minuten, nur Vielfache von 15 möglich." }, { status: 400 })
  }

  // Verify the caller is actually a Takumi (has an Expert record)
  const expert = await prisma.expert.findUnique({
    where: { userId: session.user.id },
    select: { id: true, name: true, email: true, priceVideo15Min: true, pricePerSession: true },
  })
  if (!expert) {
    return NextResponse.json({ error: "Nur Takumis können Gast-Buchungen erstellen." }, { status: 403 })
  }

  const expertEmail = expert.email?.trim() || session.user.email || ""

  const effectiveTotalPrice =
    totalPrice != null && totalPrice >= 1
      ? totalPrice
      : (Number(expert.priceVideo15Min) || (expert.pricePerSession ? expert.pricePerSession / 2 : 0)) *
        (durationMin / 15)

  const statusToken = randomBytes(32).toString("hex")
  const guestToken = randomUUID()

  const booking = await prisma.$transaction(async (tx) => {
    const conflict = await tx.booking.findFirst({
      where: {
        expertId: expert.id,
        date,
        status: { in: ["pending", "confirmed", "active"] },
        AND: [{ startTime: { lt: endTime } }, { endTime: { gt: startTime } }],
      },
    })
    if (conflict) throw new Error("SLOT_CONFLICT")

    return tx.booking.create({
      data: {
        expertId: expert.id,
        expertName: expert.name,
        expertEmail,
        // userId is null for guest bookings
        userName: guestEmail,
        userEmail: guestEmail,
        isGuestCall: true,
        guestEmail,
        guestToken,
        date,
        startTime,
        endTime,
        callType: effectiveCallType,
        totalPrice: effectiveTotalPrice,
        price: Math.round(effectiveTotalPrice),
        note: note || "",
        statusToken,
        paymentStatus: "unpaid",
        trialUsed: false,
        status: "confirmed", // Guest bookings are pre-confirmed by the Takumi
        bookingMode: "scheduled",
      },
    })
  })

  const callLink = `/call/${guestToken}`

  return NextResponse.json({
    booking: {
      id: booking.id,
      guestToken: booking.guestToken,
      callLink,
      date: booking.date,
      startTime: booking.startTime,
      endTime: booking.endTime,
      guestEmail: booking.guestEmail,
      totalPrice: booking.totalPrice,
    },
  })
})

/**
 * GET — list all guest bookings for the current Takumi.
 */
export const GET = apiHandler(async (_req) => {
  const authResult = await requireAuth()
  if (authResult.response) return authResult.response
  const { session } = authResult

  const expert = await prisma.expert.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  })
  if (!expert) {
    return NextResponse.json({ error: "Nur Takumis können Gast-Buchungen abrufen." }, { status: 403 })
  }

  const bookings = await prisma.booking.findMany({
    where: { expertId: expert.id, isGuestCall: true },
    select: {
      id: true,
      guestToken: true,
      guestEmail: true,
      date: true,
      startTime: true,
      endTime: true,
      totalPrice: true,
      paymentStatus: true,
      status: true,
      createdAt: true,
    },
    orderBy: { date: "asc" },
  })

  return NextResponse.json({ bookings })
})
