import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import {
  resolveSlots,
  resolveInstantSlots,
  EMPTY_WEEKLY_SLOTS,
  type IAvailabilityData,
  type IWeeklyRule,
  type IDateException,
  type WeeklySlots,
} from "@/lib/availability-utils"

export const runtime = "nodejs"

/**
 * GET /api/availability
 * Query params:
 *  - takumiId: Expert ID or User ID (required)
 *  - date: YYYY-MM-DD — returns resolved slots for that date
 *  - full: "true" — returns full document (slots, yearlyRules, exceptions)
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const takumiId = searchParams.get("takumiId")
  const date = searchParams.get("date")
  const full = searchParams.get("full") === "true"

  if (!takumiId) return NextResponse.json({ error: "takumiId fehlt." }, { status: 400 })

  // Input validation: restrict to expected ID format (cuid/alphanumeric)
  const idRegex = /^[a-zA-Z0-9_-]{1,50}$/
  if (!idRegex.test(takumiId)) {
    return NextResponse.json({ error: "Ungültiges Format für takumiId." }, { status: 400 })
  }
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Ungültiges Datumsformat (erwartet: YYYY-MM-DD)." }, { status: 400 })
  }

  try {
    // Resolve to userId: takumiId may be either a User ID or Expert ID
    let userId = takumiId
    const expert = await prisma.expert.findUnique({
      where: { id: takumiId },
      select: { userId: true },
    })
    if (expert?.userId) userId = expert.userId

    const avail = await prisma.availability.findUnique({ where: { userId } })
    const availData: IAvailabilityData | null = avail
      ? {
          slots: avail.slots as unknown as WeeklySlots,
          yearlyRules: avail.yearlyRules as unknown as IWeeklyRule[],
          exceptions: avail.exceptions as unknown as IDateException[],
        }
      : null
    const instantSlots = (avail?.instantSlots as WeeklySlots | null) ?? null

    if (date) {
      const slots = resolveSlots(availData, date)
      const instantSlotsForDate = resolveInstantSlots(instantSlots, date)
      return NextResponse.json({
        date,
        slots,
        instantSlots: instantSlotsForDate,
      })
    }
    if (full) {
      return NextResponse.json({
        slots: availData?.slots || EMPTY_WEEKLY_SLOTS,
        yearlyRules: availData?.yearlyRules || [],
        exceptions: availData?.exceptions || [],
        instantSlots: instantSlots || EMPTY_WEEKLY_SLOTS,
      })
    }
    return NextResponse.json({
      slots: availData?.slots || EMPTY_WEEKLY_SLOTS,
      instantSlots: instantSlots || EMPTY_WEEKLY_SLOTS,
    })
  } catch (err: unknown) {
    const { sanitizeErrorForClient } = await import("@/lib/security")
    return NextResponse.json({ error: sanitizeErrorForClient(err) }, { status: 500 })
  }
}

/**
 * PUT /api/availability
 * Save availability for the logged-in user.
 */
export async function PUT(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { slots, yearlyRules, exceptions, instantSlots } = body as {
      slots?: WeeklySlots
      yearlyRules?: IWeeklyRule[]
      exceptions?: IDateException[]
      instantSlots?: WeeklySlots
    }

    const data: Record<string, unknown> = {}
    if (slots !== undefined) data.slots = slots
    if (yearlyRules !== undefined) data.yearlyRules = yearlyRules
    if (exceptions !== undefined) data.exceptions = exceptions
    if (instantSlots !== undefined) data.instantSlots = instantSlots

    await prisma.availability.upsert({
      where: { userId: session.user.id },
      update: data,
      create: {
        userId: session.user.id,
        slots: (slots ?? EMPTY_WEEKLY_SLOTS) as object,
        yearlyRules: (yearlyRules ?? []) as object[],
        exceptions: (exceptions ?? []) as object[],
        instantSlots: (instantSlots ?? EMPTY_WEEKLY_SLOTS) as object,
      },
    })

    return NextResponse.json({ success: true, message: "Verfuegbarkeit gespeichert." })
  } catch (err: unknown) {
    const { sanitizeErrorForClient } = await import("@/lib/security")
    return NextResponse.json({ error: sanitizeErrorForClient(err) }, { status: 500 })
  }
}
