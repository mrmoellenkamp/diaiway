import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { sendPushToUser } from "@/lib/push"
import { createSystemWaymail } from "@/lib/system-waymail"
import { releaseExpiredInstantPayment } from "@/lib/instant-expired-release"

export const runtime = "nodejs"
export const maxDuration = 60

const INSTANT_EXPIRY_SEC = 60

/**
 * Cron: Cleanup unanswered Instant Connect requests (older than 60s).
 * - Release payment hold (Stripe/Wallet) if paid
 * - Set status to instant_expired
 * - Push to Shugyo: "No expert available right now. Your funds have been released."
 * Idempotent: uses atomic updateMany so concurrent accepts are not overwritten.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret?.trim()) {
    console.error("[Cron] instant-request-cleanup: No CRON_SECRET")
    return NextResponse.json({ error: "Cron not configured" }, { status: 503 })
  }
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const cutoff = new Date(Date.now() - INSTANT_EXPIRY_SEC * 1000)

  const expired = await prisma.booking.findMany({
    where: {
      bookingMode: "instant",
      status: "pending",
      createdAt: { lt: cutoff },
    },
    select: {
      id: true,
      userId: true,
      paymentStatus: true,
    },
  })

  const results: { bookingId: string; ok: boolean; error?: string }[] = []

  for (const b of expired) {
    const updated = await prisma.booking.updateMany({
      where: {
        id: b.id,
        status: "pending",
        bookingMode: "instant",
      },
      data: { status: "instant_expired" },
    })

    if (updated.count === 0) {
      results.push({ bookingId: b.id, ok: true })
      continue
    }

    const releaseResult = await releaseExpiredInstantPayment(b.id)
    if (!releaseResult.ok) {
      results.push({ bookingId: b.id, ok: false, error: releaseResult.error })
      continue
    }

    if (b.paymentStatus === "paid") {
      await prisma.booking.update({
        where: { id: b.id },
        data: { paymentStatus: "refunded" },
      })
    }

    if (b.userId) {
      sendPushToUser(b.userId, {
        title: "Keine Antwort",
        body: "Aktuell kein Experte verfügbar. Deine Mittel wurden freigegeben.",
        url: "/sessions",
        tag: `instant-expired-${b.id}`,
      }).catch(() => {})
      createSystemWaymail({
        recipientId: b.userId,
        subject: "Kein Experte verfügbar",
        body: "Aktuell kein Experte verfügbar. Deine Mittel wurden freigegeben.",
      }).catch(() => {})
    }

    results.push({ bookingId: b.id, ok: true })
  }

  return NextResponse.json({
    processed: results.length,
    ok: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    details: results,
  })
}
