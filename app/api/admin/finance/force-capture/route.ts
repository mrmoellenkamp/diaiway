import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { processCompletion } from "@/app/actions/process-completion"

/**
 * POST /api/admin/finance/force-capture
 * Admin: Force capture for a booking (session completed but trigger failed).
 * Logs to AdminActionLog.
 */
export async function POST(req: Request) {
  const session = await auth()
  const role = (session?.user as { role?: string })?.role
  if (!session?.user?.id || role !== "admin") {
    return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 })
  }

  let body: { bookingId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 })
  }

  const bookingId = body.bookingId?.trim()
  if (!bookingId) {
    return NextResponse.json({ error: "bookingId fehlt." }, { status: 400 })
  }

  try {
    const result = await processCompletion(bookingId)
    if (result.ok) {
      await prisma.adminActionLog.create({
        data: {
          adminId: session.user.id,
          action: "force_capture",
          targetType: "booking",
          targetId: bookingId,
          details: { success: true },
        },
      })
      return NextResponse.json({ success: true, message: "Capture durchgeführt." })
    }
    return NextResponse.json(
      { error: result.error ?? "Capture fehlgeschlagen." },
      { status: 400 }
    )
  } catch (err) {
    console.error("[admin/finance/force-capture] Error:", err)
    return NextResponse.json({ error: "Capture fehlgeschlagen." }, { status: 500 })
  }
}
