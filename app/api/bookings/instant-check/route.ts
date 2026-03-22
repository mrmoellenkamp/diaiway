import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { isWithinInstantSlots } from "@/lib/availability-utils"
import type { WeeklySlots } from "@/lib/availability-utils"

/**
 * GET /api/bookings/instant-check?expertId=xxx
 * Prüft für Shugyo: Hat er diesen Takumi schon bezahlt? Reicht das Guthaben für 5 Min?
 * Return: { hasPaidBefore, minBalanceCents, userBalanceCents, pricePerMinuteCents }
 */
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 })
  }

  const expertId = req.nextUrl.searchParams.get("expertId")
  if (!expertId) {
    return NextResponse.json({ error: "expertId fehlt." }, { status: 400 })
  }

  const appRole = (session.user as { appRole?: string })?.appRole
  if (appRole !== "shugyo") {
    return NextResponse.json({ error: "Nur für Shugyo." }, { status: 403 })
  }

  try {
    const expertPromise = prisma.expert.findUnique({
      where: { id: expertId },
      select: {
        userId: true,
        priceVideo15Min: true,
        pricePerSession: true,
        liveStatus: true,
      },
    })
    const availabilityPromise = expertPromise.then(async (e) =>
      e?.userId ? prisma.availability.findUnique({ where: { userId: e.userId } }) : null
    )

    const [expert, user, paidBooking, availability] = await Promise.all([
      expertPromise,
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { balance: true, isPaymentVerified: true },
      }),
      prisma.booking.findFirst({
        where: {
          userId: session.user.id,
          expertId,
          paymentStatus: "paid",
        },
        select: { id: true },
      }),
      availabilityPromise,
    ])

    if (!expert) {
      return NextResponse.json({ error: "Experte nicht gefunden." }, { status: 404 })
    }

    const price15Min = Number(
      expert.priceVideo15Min ?? (expert.pricePerSession ? expert.pricePerSession / 2 : 0)
    )
    const pricePerMinuteCents = Math.round((price15Min * 100) / 15)
    const minBalanceCents = pricePerMinuteCents * 5
    const userBalanceCents = user?.balance ?? 0
    const hasPaidBefore = !!paidBooking

    const instantSlots = availability?.instantSlots as WeeklySlots | null | undefined
    const hasInstantRestriction = instantSlots && Object.values(instantSlots).some((arr) => arr && arr.length > 0)
    const instantAvailableNow = expert.liveStatus === "available" &&
      (!hasInstantRestriction || isWithinInstantSlots(instantSlots, new Date()))

    const requiresPaymentOnboarding = user?.isPaymentVerified !== true

    return NextResponse.json({
      hasPaidBefore,
      minBalanceCents,
      userBalanceCents,
      pricePerMinuteCents,
      hasSufficientBalance: userBalanceCents >= minBalanceCents,
      instantAvailableNow,
      requiresPaymentOnboarding,
      isPaymentVerified: user?.isPaymentVerified === true,
    })
  } catch {
    return NextResponse.json({ error: "Fehler beim Prüfen." }, { status: 500 })
  }
}
