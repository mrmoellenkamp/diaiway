import { NextResponse } from "next/server"
import { randomBytes } from "crypto"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

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

  let body: { expertId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Ungültiger Body." }, { status: 400 })
  }

  const expertId = body.expertId
  if (!expertId || typeof expertId !== "string") {
    return NextResponse.json({ error: "expertId fehlt." }, { status: 400 })
  }

  try {
    const [expert, user] = await Promise.all([
      prisma.expert.findUnique({
        where: { id: expertId },
        select: {
          id: true,
          name: true,
          email: true,
          liveStatus: true,
          priceVideo15Min: true,
          pricePerSession: true,
        },
      }),
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { name: true, email: true },
      }),
    ])

    if (!expert || !user) {
      return NextResponse.json({ error: "Experte oder Nutzer nicht gefunden." }, { status: 404 })
    }

    if (expert.liveStatus !== "available") {
      return NextResponse.json(
        { error: "Takumi ist gerade nicht verfügbar. Bitte später erneut versuchen." },
        { status: 400 }
      )
    }

    const today = new Date().toISOString().slice(0, 10)
    const now = new Date()
    const startTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`
    const endTime = `${String(now.getHours()).padStart(2, "0")}:${String((now.getMinutes() + 30) % 60).padStart(2, "0")}`

    const price15Min = Number(
      expert.priceVideo15Min ?? (expert.pricePerSession ? expert.pricePerSession / 2 : 0)
    )
    const totalPrice = price15Min * 2 // 30 Min als Platzhalter

    const booking = await prisma.booking.create({
      data: {
        expertId: expert.id,
        expertName: expert.name,
        expertEmail: expert.email ?? "",
        userId: session.user.id,
        userName: user.name ?? "Shugyo",
        userEmail: user.email ?? "",
        bookingMode: "instant",
        date: today,
        startTime,
        endTime,
        status: "pending",
        totalPrice,
        statusToken: randomBytes(24).toString("hex"),
      },
    })

    return NextResponse.json({
      ok: true,
      booking: {
        id: booking.id,
        status: booking.status,
        statusToken: booking.statusToken,
      },
    })
  } catch (err) {
    console.error("[bookings/instant] Error:", err)
    return NextResponse.json({ error: "Fehler beim Erstellen." }, { status: 500 })
  }
}
