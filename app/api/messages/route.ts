import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { sendWaymailNotificationEmail } from "@/lib/email"
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
  const typeParam = req.nextUrl.searchParams.get("type") // "threads" | "waymail"
  const waymailId = req.nextUrl.searchParams.get("waymail")

  try {
    // Einzelne Waymail lesen (?waymail=id)
    if (waymailId) {
      const wm = await prisma.directMessage.findFirst({
        where: { id: waymailId, recipientId: session.user.id, communicationType: "MAIL" },
        include: { sender: { select: { name: true, image: true } } },
      })
      if (!wm) return NextResponse.json({ error: "Waymail nicht gefunden." }, { status: 404 })
      await prisma.directMessage.update({ where: { id: wm.id }, data: { read: true } })
      return NextResponse.json({
        id: wm.id,
        senderName: wm.senderDisplayName ?? wm.sender?.name ?? "Unbekannt",
        senderImageUrl: wm.sender?.image && wm.sender.image.length > 0 ? wm.sender.image : null,
        subject: wm.subject,
        text: wm.text,
        attachmentUrl: wm.attachmentUrl,
        attachmentThumbnailUrl: wm.attachmentThumbnailUrl,
        attachmentFilename: wm.attachmentFilename,
        timestamp: wm.createdAt.getTime(),
      })
    }

    // Waymail-Liste (nur MAIL, E-Mail-Browser-Layout)
    if (typeParam === "waymail") {
      const waymails = await prisma.directMessage.findMany({
        where: {
          recipientId: session.user.id,
          communicationType: "MAIL",
        },
        orderBy: { createdAt: "desc" },
        take: 100,
        include: { sender: { select: { name: true, image: true } } },
      })
      return NextResponse.json({
        waymails: waymails.map((m) => ({
          id: m.id,
          senderName: m.senderDisplayName ?? m.sender?.name ?? "Unbekannt",
          senderImageUrl: m.sender?.image && m.sender.image.length > 0 ? m.sender.image : null,
          subject: m.subject ?? "(ohne Betreff)",
          textPreview: m.text.slice(0, 100) + (m.text.length > 100 ? "…" : ""),
          timestamp: m.createdAt.getTime(),
          read: m.read,
        })),
      })
    }

    if (withUserId) {
      // Load messages in thread with specific user
      const partnerId = withUserId
      if (partnerId === session.user.id) {
        return NextResponse.json({ messages: [] })
      }
      const messages = await prisma.directMessage.findMany({
        where: {
          communicationType: "CHAT",
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
        where: { recipientId: session.user.id, senderId: partnerId, read: false, communicationType: "CHAT" },
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

    // List CHAT threads (nur communicationType CHAT)
    const sent = await prisma.directMessage.findMany({
      where: { senderId: session.user.id, communicationType: "CHAT" },
      select: { recipientId: true },
      distinct: ["recipientId"],
    })
    const received = await prisma.directMessage.findMany({
      where: { recipientId: session.user.id, communicationType: "CHAT", senderId: { not: null } },
      select: { senderId: true },
      distinct: ["senderId"],
    })
    const partnerIds = [...new Set([...sent.map((s) => s.recipientId), ...received.map((r) => r.senderId!).filter(Boolean)])].filter(
      (id): id is string => id != null && id !== session.user.id
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
            communicationType: "CHAT",
            OR: [
              { senderId: session.user.id, recipientId: partnerId },
              { senderId: partnerId, recipientId: session.user.id },
            ],
          },
          orderBy: { createdAt: "desc" },
        })
        const unread = await prisma.directMessage.count({
          where: { recipientId: session.user.id, senderId: partnerId, read: false, communicationType: "CHAT" },
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
    const {
      recipientUserId,
      recipientExpertId,
      text,
      subject,
      communicationType = "CHAT",
      attachmentUrl,
      attachmentThumbnailUrl,
      attachmentFilename,
    } = body as {
      recipientUserId?: string
      recipientExpertId?: string
      text?: string
      subject?: string
      communicationType?: "CHAT" | "MAIL"
      attachmentUrl?: string
      attachmentThumbnailUrl?: string
      attachmentFilename?: string
    }

    const trimmed = typeof text === "string" ? text.trim() : ""
    const hasAttachment = typeof attachmentUrl === "string" && attachmentUrl.length > 0
    if (!trimmed && !hasAttachment) {
      return NextResponse.json({ error: "Nachricht oder Anhang erforderlich." }, { status: 400 })
    }

    // Waymail erfordert Betreff
    if (communicationType === "MAIL") {
      const sub = typeof subject === "string" ? subject.trim() : ""
      if (!sub) {
        return NextResponse.json({ error: "Waymail erfordert einen Betreff." }, { status: 400 })
      }
    }

    const recipientId = await resolveRecipientUserId(recipientExpertId, recipientUserId)
    if (!recipientId || recipientId === session.user.id) {
      return NextResponse.json({ error: "Empfänger nicht gefunden." }, { status: 400 })
    }

    const message = await prisma.directMessage.create({
      data: {
        communicationType: communicationType === "MAIL" ? "MAIL" : "CHAT",
        senderId: session.user.id,
        recipientId,
        subject: communicationType === "MAIL" ? (typeof subject === "string" ? subject.trim() : "") : null,
        text: trimmed || "(Anhang)",
        attachmentUrl: hasAttachment ? attachmentUrl : null,
        attachmentThumbnailUrl: attachmentThumbnailUrl || null,
        attachmentFilename: attachmentFilename || null,
      },
    })

    const recipient = await prisma.user.findUnique({
      where: { id: recipientId },
      select: { name: true, email: true },
    })
    const senderName = session.user.name ?? "Jemand"

    if (communicationType === "CHAT") {
      // CHAT: nur Push, keine E-Mail
      try {
        await prisma.notification.create({
          data: {
            userId: recipientId,
            type: "new_message",
            title: `${senderName} schreibt dir…`,
            body: trimmed.length > 60 ? trimmed.slice(0, 60) + "…" : trimmed,
          },
        })
        sendPushToUser(recipientId, {
          title: `${senderName} schreibt dir…`,
          body: trimmed.slice(0, 60) + (trimmed.length > 60 ? "…" : ""),
          url: `/messages?with=${encodeURIComponent(session.user.id)}`,
        }).catch(() => {})
      } catch (e) {
        console.warn("[messages] Notification/Push failed:", e)
      }
    } else {
      // WAYMAIL: E-Mail (nur Absender + Betreff, Privacy), Push mit Deep-Link
      const waymailUrl = `${baseUrl}/messages?waymail=${message.id}`
      try {
        await prisma.notification.create({
          data: {
            userId: recipientId,
            type: "new_message",
            title: `Waymail von ${senderName}`,
            body: (message.subject ?? "").slice(0, 80),
          },
        })
        sendPushToUser(recipientId, {
          title: `Waymail von ${senderName}`,
          body: (message.subject ?? "").slice(0, 60),
          url: waymailUrl,
        }).catch(() => {})
      } catch (e) {
        console.warn("[messages] Notification/Push failed:", e)
      }
      if (recipient?.email) {
        sendWaymailNotificationEmail({
          to: recipient.email,
          recipientName: recipient.name ?? "Nutzer",
          senderName,
          subject: message.subject ?? "(ohne Betreff)",
          waymailUrl,
        }).catch((e) => console.warn("[messages] Waymail Email failed:", e))
      }
    }

    return NextResponse.json({
      id: message.id,
      text: message.text,
      subject: message.subject ?? undefined,
      communicationType: message.communicationType,
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
