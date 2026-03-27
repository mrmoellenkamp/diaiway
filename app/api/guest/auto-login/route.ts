import { NextResponse } from "next/server"
import { createHmac } from "crypto"
import { prisma } from "@/lib/db"
import { rateLimit, getClientIp } from "@/lib/rate-limit"

export const runtime = "nodejs"

/**
 * GET /api/guest/auto-login?guestToken=...
 *
 * After a successful guest payment, the guest page calls this endpoint.
 * If the booking has a linked userId (account was created during onboarding),
 * returns a short-lived signed auto-login token.
 *
 * The token is then passed to /api/guest/signin?token=... which creates a NextAuth session.
 */
export async function GET(req: Request) {
  const ip = getClientIp(req)
  const rl = rateLimit(`guest-autologin:${ip}`, { limit: 20, windowSec: 3600 })
  if (!rl.success) {
    return NextResponse.json({ error: "Zu viele Anfragen." }, { status: 429 })
  }

  const { searchParams } = new URL(req.url)
  const guestToken = searchParams.get("guestToken")

  if (!guestToken) {
    return NextResponse.json({ error: "guestToken fehlt." }, { status: 400 })
  }

  const booking = await prisma.booking.findUnique({
    where: { guestToken },
    select: { id: true, userId: true, paymentStatus: true, isGuestCall: true },
  })

  if (!booking || !booking.isGuestCall) {
    return NextResponse.json({ error: "Buchung nicht gefunden." }, { status: 404 })
  }
  if (booking.paymentStatus !== "paid") {
    return NextResponse.json({ canAutoLogin: false, reason: "not_paid" })
  }
  if (!booking.userId) {
    // Payment done but no account created (guest chose not to set a password)
    return NextResponse.json({ canAutoLogin: false, reason: "no_account" })
  }

  // Create a short-lived signed token (10 minutes)
  const expiresAt = Date.now() + 10 * 60 * 1000
  const payload = `${booking.userId}:${booking.id}:${expiresAt}`
  const secret = process.env.NEXTAUTH_SECRET!
  const sig = createHmac("sha256", secret).update(payload).digest("hex")
  const token = Buffer.from(`${payload}:${sig}`).toString("base64url")

  return NextResponse.json({ canAutoLogin: true, token })
}
