import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { translateError } from "@/lib/api-handler"
import { assertRateLimit } from "@/lib/api-rate-limit"
import { logSecureError } from "@/lib/log-redact"

export const runtime = "nodejs"
const NOTIFICATION_RETENTION_DAYS = 7

/** GET — list notifications for the current user */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 })
  }

  try {
    const cutoff = new Date(Date.now() - NOTIFICATION_RETENTION_DAYS * 24 * 60 * 60 * 1000)
    await prisma.notification.deleteMany({
      where: {
        userId: session.user.id,
        createdAt: { lt: cutoff },
      },
    })

    const [notifications, unreadCount, unreadChats, unreadWaymails] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.notification.count({
        where: { userId: session.user.id, read: false },
      }),
      prisma.directMessage.count({
        where: {
          recipientId: session.user.id,
          read: false,
          communicationType: "CHAT",
          senderId: { not: null },
        },
      }),
      prisma.directMessage.count({
        where: {
          recipientId: session.user.id,
          read: false,
          communicationType: "MAIL",
        },
      }),
    ])
    const totalInboxUnread = unreadCount + unreadChats + unreadWaymails
    return NextResponse.json({
      notifications: notifications.map((n) => ({
        id: n.id,
        type: n.type,
        bookingId: n.bookingId,
        title: n.title,
        body: n.body,
        read: n.read,
        createdAt: n.createdAt,
      })),
      unreadCount,
      totalInboxUnread,
    })
  } catch (err) {
    logSecureError("notifications.GET", err)
    return translateError(err)
  }
}

function sanitizeIds(ids: unknown): string[] | null {
  if (!Array.isArray(ids)) return null
  if (ids.length === 0 || ids.length > 200) return null
  const safe: string[] = []
  for (const id of ids) {
    if (typeof id !== "string" || id.length === 0 || id.length > 100) return null
    safe.push(id)
  }
  return safe
}

/** PATCH — mark notifications as read (ids or all) */
export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 })
  }

  const rl = await assertRateLimit(
    { req, userId: session.user.id },
    { bucket: "notifications:patch", limit: 120, windowSec: 600 }
  )
  if (rl) return rl

  try {
    const body = await req.json().catch(() => ({}))
    const ids = sanitizeIds((body as { ids?: unknown }).ids)

    if (ids && ids.length > 0) {
      await prisma.notification.updateMany({
        where: { id: { in: ids }, userId: session.user.id },
        data: { read: true },
      })
    } else {
      await prisma.notification.updateMany({
        where: { userId: session.user.id },
        data: { read: true },
      })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    logSecureError("notifications.PATCH", err)
    return translateError(err)
  }
}

/** DELETE — remove notifications (ids or all) */
export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 })
  }

  const rl = await assertRateLimit(
    { req, userId: session.user.id },
    { bucket: "notifications:delete", limit: 60, windowSec: 600 }
  )
  if (rl) return rl

  try {
    const body = await req.json().catch(() => ({}))
    const ids = sanitizeIds((body as { ids?: unknown }).ids)

    if (ids && ids.length > 0) {
      await prisma.notification.deleteMany({
        where: { id: { in: ids }, userId: session.user.id },
      })
    } else {
      await prisma.notification.deleteMany({
        where: { userId: session.user.id },
      })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    logSecureError("notifications.DELETE", err)
    return translateError(err)
  }
}
