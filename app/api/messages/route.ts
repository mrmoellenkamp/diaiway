import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { sendNewMessageEmail } from "@/lib/email"
import { sendPushToUser } from "@/lib/push"

export const runtime = "nodejs"

const baseUrl = process.env.NEXTAUTH_URL || "https://diaiway.com"

/** Resolve recipient User id from expertId or userId */
async function resolveRecipientUserId(recipientExpertId?: string, recipientUserId?: string): Promise<string | null> {
  if (recipientUserId) {
    const u = await prisma.user.findUnique({ where: { id: recipientUserId }, select: { id: true } })
    return u?.id ?? null
  }
  if (recipientExpertId) {
    const e = await prisma.expert.findUnique({
      where: { id: recipientExpertId },
      select: { userId: true },
    })
    return e?.userId ?? null
  }
  return null
}

/** GET — list message threads for current user */
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 })
  }

  const withUserId = req.nextUrl.searchParams.get("with")

  try {
    if (withUserId) {
      // Load messages in thread with specific user
      const partnerId = withUserId
      if (partnerId === session.user.id) {
        return NextResponse.json({ messages: [] })
      }
      const messages = await prisma.directMessage.findMany({
        where: {
          OR: [
            { senderId: session.user.id, recipientId: partnerId },
            { senderId: partnerId, recipientId: session.user.id },
          ],
        },
        orderBy: { createdAt: "asc" },
        include: {
          sender: { select: { id: true, name: true, image: true } },
        },
      })
      // Mark as read for current user
      await prisma.directMessage.updateMany({
        where: { recipientId: session.user.id, senderId: partnerId, read: false },
        data: { read: true },
      })
      return NextResponse.json({
        messages: messages.map((m) => ({
          id: m.id,
          text: m.text,
          sender: m.senderId === session.user.id ? "user" : "partner",
          senderName: m.sender?.name,
          timestamp: m.createdAt.getTime(),
          read: m.read,
          attachmentUrl: m.attachmentUrl,
          attachmentThumbnailUrl: m.attachmentThumbnailUrl,
          attachmentFilename: m.attachmentFilename,
        })),
      })
    }

    // List threads (conversations)
    const sent = await prisma.directMessage.findMany({
      where: { senderId: session.user.id },
      select: { recipientId: true },
      distinct: ["recipientId"],
    })
    const received = await prisma.directMessage.findMany({
      where: { recipientId: session.user.id },
      select: { senderId: true },
      distinct: ["senderId"],
    })
    const partnerIds = [...new Set([...sent.map((s) => s.recipientId), ...received.map((r) => r.senderId)])].filter(
      (id) => id !== session.user.id
    )

    const threads = await Promise.all(
      partnerIds.map(async (partnerId) => {
        const user = await prisma.user.findUnique({
          where: { id: partnerId },
          select: { id: true, name: true, image: true },
        })
        const expert = await prisma.expert.findFirst({
          where: { userId: partnerId },
          select: { id: true, avatar: true, imageUrl: true, subcategory: true, isLive: true, lastSeenAt: true },
        })
        const lastMsg = await prisma.directMessage.findFirst({
          where: {
            OR: [
              { senderId: session.user.id, recipientId: partnerId },
              { senderId: partnerId, recipientId: session.user.id },
            ],
          },
          orderBy: { createdAt: "desc" },
        })
        const unread = await prisma.directMessage.count({
          where: { recipientId: session.user.id, senderId: partnerId, read: false },
        })
        const displayName = user?.name ?? "Nutzer"
        const avatar = expert?.avatar ?? (displayName.slice(0, 2).toUpperCase() || "?")
        const subcategory = expert?.subcategory ?? ""
        const partnerImageUrl = expert?.imageUrl || (user?.image && user.image.length > 0 ? user.image : null)

        const now = Date.now()
        const ONLINE_MS = 5 * 60 * 1000
        const lastSeen = expert?.lastSeenAt?.getTime()
        const isOnline = expert?.isLive === true && lastSeen != null && now - lastSeen < ONLINE_MS

        return {
          partnerId,
          partnerName: displayName,
          partnerAvatar: avatar,
          partnerImageUrl: partnerImageUrl ?? null,
          subcategory,
          expertId: expert?.id ?? null,
          isOnline: !!isOnline,
          lastMessage: lastMsg
            ? {
                text: lastMsg.text,
                sender: lastMsg.senderId === session.user.id ? "user" : "partner",
                timestamp: lastMsg.createdAt.getTime(),
              }
            : null,
          unread,
        }
      })
    )

    threads.sort((a, b) => {
      const aTime = a.lastMessage?.timestamp ?? 0
      const bTime = b.lastMessage?.timestamp ?? 0
      return bTime - aTime
    })

    return NextResponse.json({ threads })
  } catch (err) {
    console.error("[messages] GET error:", err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

/** POST — send a message */
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const { recipientUserId, recipientExpertId, text, notifyByEmail, attachmentUrl, attachmentThumbnailUrl, attachmentFilename } = body as {
      recipientUserId?: string
      recipientExpertId?: string
      text?: string
      notifyByEmail?: boolean
      attachmentUrl?: string
      attachmentThumbnailUrl?: string
      attachmentFilename?: string
    }

    const trimmed = typeof text === "string" ? text.trim() : ""
    const hasAttachment = typeof attachmentUrl === "string" && attachmentUrl.length > 0
    if (!trimmed && !hasAttachment) {
      return NextResponse.json({ error: "Nachricht oder Anhang erforderlich." }, { status: 400 })
    }

    const recipientId = await resolveRecipientUserId(recipientExpertId, recipientUserId)
    if (!recipientId || recipientId === session.user.id) {
      return NextResponse.json({ error: "Empfänger nicht gefunden." }, { status: 400 })
    }

    const message = await prisma.directMessage.create({
      data: {
        senderId: session.user.id,
        recipientId,
        text: trimmed || "(Anhang)",
        attachmentUrl: hasAttachment ? attachmentUrl : null,
        attachmentThumbnailUrl: attachmentThumbnailUrl || null,
        attachmentFilename: attachmentFilename || null,
      },
    })

    // Notification für Empfänger
    const recipient = await prisma.user.findUnique({
      where: { id: recipientId },
      select: { name: true, email: true },
    })
    const senderName = session.user.name ?? "Jemand"

    try {
      await prisma.notification.create({
        data: {
          userId: recipientId,
          type: "new_message",
          title: `Neue Nachricht von ${senderName}`,
          body: trimmed.length > 80 ? trimmed.slice(0, 80) + "…" : trimmed,
        },
      })
      sendPushToUser(recipientId, {
        title: `Neue Nachricht von ${senderName}`,
        body: trimmed.slice(0, 60) + (trimmed.length > 60 ? "…" : ""),
        url: `/messages?with=${encodeURIComponent(session.user.id)}`,
      }).catch(() => {})
    } catch (e) {
      console.warn("[messages] Notification/Push failed:", e)
    }

    // E-Mail an Empfänger nur bei Mail-Nachrichten (nicht bei Chat)
    if (notifyByEmail === true && recipient?.email) {
      sendNewMessageEmail({
        to: recipient.email,
        recipientName: recipient.name ?? "Nutzer",
        senderName,
        messagePreview: trimmed,
        inboxUrl: `${baseUrl}/messages`,
      }).catch((e) => console.warn("[messages] Email failed:", e))
    }

    return NextResponse.json({
      id: message.id,
      text: message.text,
      sender: "user",
      timestamp: message.createdAt.getTime(),
      recipientUserId: recipientId,
      attachmentUrl: message.attachmentUrl,
      attachmentThumbnailUrl: message.attachmentThumbnailUrl,
      attachmentFilename: message.attachmentFilename,
    })
  } catch (err) {
    console.error("[messages] POST error:", err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
