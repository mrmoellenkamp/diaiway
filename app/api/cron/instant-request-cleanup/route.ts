import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { sendPushToUser } from "@/lib/push"
import { pushT } from "@/lib/push-strings"
import { getUserPreferredLocale } from "@/lib/user-preferred-locale"
import { createSystemWaymail } from "@/lib/system-waymail"
import { releaseExpiredInstantPayment } from "@/lib/instant-expired-release"
import { assertCronAuthorized } from "@/lib/cron-auth"

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
  const authErr = assertCronAuthorized(req, "instant-request-cleanup")
  if (authErr) return authErr

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
      const loc = await getUserPreferredLocale(b.userId)
      const subj = pushT(loc, "instantExpiredWaymailSubject")
      const msg = pushT(loc, "instantExpiredWaymailBody")
      sendPushToUser(b.userId, {
        title: pushT(loc, "instantExpiredPushTitle"),
        body: msg,
        url: "/sessions",
        tag: `instant-expired-${b.id}`,
      }).catch(() => {})
      createSystemWaymail({
        recipientId: b.userId,
        subject: subj,
        body: msg,
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
