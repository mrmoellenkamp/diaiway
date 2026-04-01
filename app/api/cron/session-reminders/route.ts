import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { berlinDateStringsThreeDayWindow, parseBerlinDateTime } from "@/lib/date-utils"
import { sendPushToUser } from "@/lib/push"
import { pushT } from "@/lib/push-strings"
import { getUserPreferredLocale } from "@/lib/user-preferred-locale"
import { communicationUsername } from "@/lib/communication-display"

export const runtime = "nodejs"

/**
 * GET/POST /api/cron/session-reminders
 * Sendet 5-Minuten-Erinnerung vor geplanten Sessions (Push + In-App Notification).
 * Absicherung via CRON_SECRET (Authorization: Bearer <CRON_SECRET>).
 */
async function runSessionReminders() {
  const now = new Date()
  /** booking.date ist Kalendertag in Europe/Berlin — nicht UTC-Datum filtern. */
  const berlinDates = berlinDateStringsThreeDayWindow(now)

  const candidates = await prisma.booking.findMany({
    where: {
      bookingMode: "scheduled",
      status: "confirmed",
      paymentStatus: "paid",
      date: { in: berlinDates },
    },
    include: {
      user: { select: { id: true, username: true } },
      expert: { include: { user: { select: { id: true, username: true } } } },
    },
  })

  let sent = 0
  let skipped = 0

  for (const b of candidates) {
    const start = parseBerlinDateTime(b.date, b.startTime || "00:00")
    const msUntilStart = start.getTime() - now.getTime()
    // Nur genaues 5-Min-Fenster (0..5 Minuten)
    if (msUntilStart < 0 || msUntilStart > 5 * 60 * 1000) {
      skipped += 1
      continue
    }

    const takumiName = communicationUsername(b.expert?.user?.username, "Takumi")
    const shugyoName = communicationUsername(b.user?.username, "Shugyo")
    const bookingUrl = `/session/${b.id}?connecting=1`

    // Bucher erinnern (nur bei regulären Buchungen mit userId)
    if (!b.userId) { skipped += 1; continue }
    const userReminderExists = await prisma.notification.findFirst({
      where: { userId: b.userId, bookingId: b.id, type: "booking_reminder" },
      select: { id: true },
    })
    if (!userReminderExists) {
      const bookerLoc = await getUserPreferredLocale(b.userId)
      await prisma.notification.create({
        data: {
          userId: b.userId,
          bookingId: b.id,
          type: "booking_reminder",
          title: pushT(bookerLoc, "sessionReminderUserInappTitle"),
          body: pushT(bookerLoc, "sessionReminderUserInappBody", { partnerName: takumiName }),
        },
      })
      sendPushToUser(b.userId, {
        title: pushT(bookerLoc, "sessionReminderUserPushTitle"),
        body: pushT(bookerLoc, "sessionReminderUserPushBody", {
          partnerName: takumiName,
          time: b.startTime || "",
        }),
        url: bookingUrl,
        tag: `booking-reminder-${b.id}-user`,
        pushType: "REMINDER",
      }).catch(() => {})
      sent += 1
    } else {
      skipped += 1
    }

    // Takumi erinnern (falls Nutzerkonto verknüpft)
    const takumiUserId = b.expert?.userId ?? null
    if (takumiUserId) {
      const expertReminderExists = await prisma.notification.findFirst({
        where: { userId: takumiUserId, bookingId: b.id, type: "booking_reminder" },
        select: { id: true },
      })
      if (!expertReminderExists) {
        const expertLoc = await getUserPreferredLocale(takumiUserId)
        await prisma.notification.create({
          data: {
            userId: takumiUserId,
            bookingId: b.id,
            type: "booking_reminder",
            title: pushT(expertLoc, "sessionReminderExpertInappTitle"),
            body: pushT(expertLoc, "sessionReminderExpertInappBody", { partnerName: shugyoName }),
          },
        })
        sendPushToUser(takumiUserId, {
          title: pushT(expertLoc, "sessionReminderExpertPushTitle"),
          body: pushT(expertLoc, "sessionReminderExpertPushBody", {
            partnerName: shugyoName,
            time: b.startTime || "",
          }),
          url: bookingUrl,
          tag: `booking-reminder-${b.id}-expert`,
          pushType: "REMINDER",
        }).catch(() => {})
        sent += 1
      } else {
        skipped += 1
      }
    }
  }

  await prisma.cronRunLog.upsert({
    where: { cronName: "session-reminders" },
    create: { cronName: "session-reminders", lastRunAt: new Date() },
    update: { lastRunAt: new Date() },
  }).catch(() => {})

  return { ok: true, candidates: candidates.length, sent, skipped }
}

function isAuthorized(req: Request): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret?.trim()) return false
  return req.headers.get("authorization") === `Bearer ${cronSecret}`
}

export async function GET(req: Request) {
  if (!process.env.CRON_SECRET?.trim()) {
    console.error("[Cron] session-reminders: CRON_SECRET not configured")
    return NextResponse.json({ error: "Cron not configured" }, { status: 503 })
  }
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  return NextResponse.json(await runSessionReminders())
}

export async function POST(req: Request) {
  if (!process.env.CRON_SECRET?.trim()) {
    console.error("[Cron] session-reminders: CRON_SECRET not configured")
    return NextResponse.json({ error: "Cron not configured" }, { status: 503 })
  }
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  return NextResponse.json(await runSessionReminders())
}
