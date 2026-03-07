import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { adminRefundFromPending } from "@/lib/wallet-service"

export const runtime = "nodejs"

/**
 * POST /api/admin/wallet/refund
 * Admin: Refund aus pendingBalance. Stripe-Refund muss vorher durchgeführt werden.
 * Body: { transactionId: string, stripeRefundCompleted: boolean }
 */
export async function POST(req: NextRequest) {
  const session = await auth()
  const role = (session?.user as { role?: string })?.role
  if (!session?.user?.id || role !== "admin") {
    return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 })
  }

  let body: { transactionId?: string; stripeRefundCompleted?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 })
  }

  const { transactionId, stripeRefundCompleted } = body
  if (!transactionId || stripeRefundCompleted !== true) {
    return NextResponse.json(
      { error: "transactionId und stripeRefundCompleted: true erforderlich." },
      { status: 400 }
    )
  }

  const result = await adminRefundFromPending(transactionId, true)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }
  return NextResponse.json({ success: true })
}
