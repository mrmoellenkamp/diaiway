import { NextResponse } from "next/server"
import { createHmac } from "crypto"
import { prisma } from "@/lib/db"
import { rateLimit, getClientIp } from "@/lib/rate-limit"

export const runtime = "nodejs"

/**
 * GET /api/guest/signin?token=...&callbackUrl=...
 *
 * Validates the auto-login token from /api/guest/auto-login.
 * Returns the user's email so the guest page can redirect to /login with the email pre-filled,
 * or shows a "your account is ready" message.
 *
 * Note: Full session injection via NextAuth server-side is not possible without a custom
 * credentials flow. We therefore redirect to /login with the email pre-filled and a
 * "account_created" hint so the login page can show a friendly message.
 */
export async function GET(req: Request) {
  const ip = getClientIp(req)
  const rl = await rateLimit(`guest-signin:${ip}`, { limit: 10, windowSec: 3600 })
  if (!rl.success) {
    return NextResponse.json({ error: "Zu viele Anfragen." }, { status: 429 })
  }

  const { searchParams } = new URL(req.url)
  const token = searchParams.get("token")
  const callbackUrl = searchParams.get("callbackUrl") || "/home"

  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  try {
    const decoded = Buffer.from(token, "base64url").toString("utf-8")
    const parts = decoded.split(":")
    if (parts.length !== 4) throw new Error("Invalid format")

    const [userId, , expiresAtStr, sig] = parts
    const expiresAt = parseInt(expiresAtStr, 10)

    if (Date.now() > expiresAt) {
      return NextResponse.redirect(new URL("/login?reason=token_expired", req.url))
    }

    const payload = `${parts[0]}:${parts[1]}:${expiresAtStr}`
    const secret = process.env.NEXTAUTH_SECRET!
    const expectedSig = createHmac("sha256", secret).update(payload).digest("hex")
    if (sig !== expectedSig) {
      return NextResponse.redirect(new URL("/login?reason=invalid_token", req.url))
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    })
    if (!user?.email) {
      return NextResponse.redirect(new URL("/login", req.url))
    }

    // Redirect to login with email pre-filled and a hint that the account was just created
    const loginUrl = new URL("/login", req.url)
    loginUrl.searchParams.set("email", user.email)
    loginUrl.searchParams.set("hint", "account_created")
    loginUrl.searchParams.set("callbackUrl", callbackUrl)
    return NextResponse.redirect(loginUrl)
  } catch {
    return NextResponse.redirect(new URL("/login", req.url))
  }
}
