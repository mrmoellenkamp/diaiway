import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { createHmac } from "crypto"
import { prisma } from "@/lib/db"
import { validateInvoiceDataForPayment } from "@/lib/invoice-requirements"

export const runtime = "nodejs"

const MIN_CENTS = 2000
const MAX_CENTS = 10000

/**
 * POST /api/wallet/topup/token
 * Body: { amountCents: number }
 * Erstellt einen kurzlebigen HMAC-Token für die /pay/wallet Seite.
 * 15-Minuten-TTL, enthält userId + amountCents.
 */
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const amountCents = Number(body.amountCents)

  if (!amountCents || amountCents < MIN_CENTS || amountCents > MAX_CENTS) {
    return NextResponse.json({ error: "Ungültiger Betrag." }, { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { invoiceData: true },
  })
  const invoiceValidation = validateInvoiceDataForPayment(user?.invoiceData)
  if (!invoiceValidation.ok) {
    return NextResponse.json(
      {
        error: invoiceValidation.message,
        code: "INVOICE_DATA_INCOMPLETE",
        redirectTo: "/profile/invoice-data?required=1",
      },
      { status: 409 }
    )
  }

  const expiresAt = Date.now() + 15 * 60 * 1000
  const payload = `${session.user.id}:${amountCents}:${expiresAt}`
  const secret = process.env.NEXTAUTH_SECRET!
  const sig = createHmac("sha256", secret).update(payload).digest("hex")
  const token = Buffer.from(`${payload}:${sig}`).toString("base64url")

  return NextResponse.json({ token })
}
