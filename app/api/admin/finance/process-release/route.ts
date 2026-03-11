import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { processCompletion } from "@/app/actions/process-completion"

/**
 * POST /api/admin/finance/process-release
 * Admin-Override: processCompletion für eine Buchung auslösen (Rechnung, Gutschrift, E-Mail).
 * Body: { bookingId: string }
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
      return NextResponse.json({ success: true, message: "Freigabe durchgeführt. Rechnung und E-Mail wurden erstellt." })
    }
    return NextResponse.json(
      { error: result.error ?? "Freigabe fehlgeschlagen." },
      { status: 400 }
    )
  } catch (err) {
    console.error("[admin/finance/process-release] Error:", err)
    const { sanitizeErrorForClient } = await import("@/lib/security")
    return NextResponse.json({ error: sanitizeErrorForClient(err) }, { status: 500 })
  }
}
