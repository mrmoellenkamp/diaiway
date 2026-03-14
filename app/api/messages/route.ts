import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { sendWaymailNotificationEmail } from "@/lib/email"
import { sendPushToUser } from "@/lib/push"
import { z } from "zod"
import { requireAuth } from "@/lib/api-auth"
import { apiHandler } from "@/lib/api-handler"

export const runtime = "nodejs"

const baseUrl = process.env.NEXTAUTH_URL || "https://diaiway.com"

const MessagePostSchema = z.object({
  recipientUserId: z.string().cuid().optional(),
  recipientExpertId: z.string().cuid().optional(),
  text: z.string().max(4000).optional(),
  subject: z.string().optional(),
  communicationType: z.enum(["CHAT", "MAIL"]).default("CHAT"),
  attachmentUrl: z.string().optional(),
  attachmentThumbnailUrl: z.string().optional(),
  attachmentFilename: z.string().optional(),
}).refine(
  (data) => {
    const hasText = typeof data.text === "string" && data.text.trim().length >= 1
    const hasAttachment = typeof data.attachmentUrl === "string" && data.attachmentUrl.length > 0
    return hasText || hasAttachment
  },
  { message: "Nachricht oder Anhang erforderlich." }
).refine(
  (data) => {
    if (data.communicationType === "MAIL") {
      return typeof data.subject === "string" && data.subject.trim().length >= 1
    }
    return true
  },
  { message: "Waymail erfordert einen Betreff." }
)

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
export const GET = apiHandler(async (req: NextRequest) => {
  const authResult = await requireAuth()
  if (authResult.response) return authResult.response
  const session = authResult.session

  const withUserId = req.nextUrl.searchParams.get("with")
  const typeParam = req.nextUrl.searchParams.get("type")
  const waymailId = req.nextUrl.searchParams.get("waymail")

  if (waymailId) {
    const wm = await prisma.directMessage.findFirst({
      where: { id: waymailId, recipientId: session.user.id, communicationType: "MAIL" },
      include: { sender: { select: { name: true, image: true } } },
    })
    if (!wm) return NextResponse.json({ error: "Waymail nicht gefunden." }, { status: 404 })
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
      read: wm.read,
    })
  }

  if (typeParam === "waymail") {
    const raw = await prisma.directMessage.findMany({
      where: {
        recipientId: session.user.id,
        communicationType: "MAIL",
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { sender: { select: { name: true, image: true } } },
    })
    const mapped = raw.map((m) => {
      const isSystem = !m.senderId || m.senderDisplayName === "diAiway System"
      return {
        id: m.id,
        senderName: m.senderDisplayName ?? m.sender?.name ?? "Unbekannt",
        senderImageUrl: m.sender?.image && m.sender.image.length > 0 ? m.sender.image : null,
        subject: m.subject ?? "(ohne Betreff)",
        textPreview: m.text.slice(0, 100) + (m.text.length > 100 ? "…" : ""),
        timestamp: m.createdAt.getTime(),
        read: m.read,
        isSystemWaymail: isSystem,
      }
    })
    return NextResponse.json({ waymails: mapped })
  }

  if (withUserId) {
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

  if (partnerIds.length === 0) {
    return NextResponse.json({ threads: [] })
  }

  const [users, experts, allLastMsgs, unreadCounts] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: partnerIds } },
      select: { id: true, name: true, image: true, isVerified: true },
    }),
    prisma.expert.findMany({
      where: { userId: { in: partnerIds } },
      select: { userId: true, id: true, avatar: true, imageUrl: true, subcategory: true, isLive: true, lastSeenAt: true, verified: true },
    }),
    prisma.directMessage.findMany({
      where: {
        communicationType: "CHAT",
        OR: partnerIds.flatMap((pid) => [
          { senderId: session.user.id, recipientId: pid },
          { senderId: pid, recipientId: session.user.id },
        ]),
      },
      orderBy: { createdAt: "desc" },
      select: { senderId: true, recipientId: true, text: true, createdAt: true },
    }),
    prisma.directMessage.groupBy({
      by: ["senderId"],
      where: {
        recipientId: session.user.id,
        senderId: { in: partnerIds },
        read: false,
        communicationType: "CHAT",
      },
      _count: { id: true },
    }),
  ])

  const userMap = new Map(users.map((u) => [u.id, u]))
  const expertMap = new Map(experts.map((e) => [e.userId, e]))
  const lastMsgByPartner = new Map<string, { text: string; sender: string; timestamp: number }>()
  for (const m of allLastMsgs) {
    const partnerId = m.senderId === session.user.id ? m.recipientId : m.senderId
    if (partnerId == null || lastMsgByPartner.has(partnerId)) continue
    lastMsgByPartner.set(partnerId, {
      text: m.text,
      sender: m.senderId === session.user.id ? "user" : "partner",
      timestamp: m.createdAt.getTime(),
    })
  }
  const unreadByPartner = new Map(unreadCounts.map((u) => [u.senderId, u._count.id]))

  const now = Date.now()
  const ONLINE_MS = 30 * 1000

  const threads = partnerIds.map((partnerId) => {
    const user = userMap.get(partnerId)
    const expert = expertMap.get(partnerId)
    const lastMsg = lastMsgByPartner.get(partnerId)
    const unread = unreadByPartner.get(partnerId) ?? 0
    const displayName = user?.name ?? "Nutzer"
    const avatar = expert?.avatar ?? (displayName.slice(0, 2).toUpperCase() || "?")
    const subcategory = expert?.subcategory ?? ""
    const partnerImageUrl = expert?.imageUrl || (user?.image && user.image.length > 0 ? user.image : null)
    const lastSeen = expert?.lastSeenAt?.getTime()
    const isOnline = expert?.isLive === true && lastSeen != null && now - lastSeen < ONLINE_MS
    const partnerIsVerified = expert?.verified ?? user?.isVerified ?? false
    return {
      partnerId,
      partnerName: displayName,
      partnerAvatar: avatar,
      partnerImageUrl: partnerImageUrl ?? null,
      partnerIsVerified,
      subcategory,
      expertId: expert?.id ?? null,
      isOnline: !!isOnline,
      lastMessage: lastMsg ?? null,
      unread,
    }
  })

  threads.sort((a, b) => {
    const aTime = a.lastMessage?.timestamp ?? 0
    const bTime = b.lastMessage?.timestamp ?? 0
    return bTime - aTime
  })

  return NextResponse.json({ threads })
})

/** POST — send a message */
export const POST = apiHandler(async (req) => {
  const authResult = await requireAuth()
  if (authResult.response) return authResult.response
  const session = authResult.session

  const rawBody = await req.json().catch(() => ({}))
  const body = MessagePostSchema.parse(rawBody)

  const trimmed = typeof body.text === "string" ? body.text.trim() : ""
  const hasAttachment = typeof body.attachmentUrl === "string" && body.attachmentUrl.length > 0

  const recipientId = await resolveRecipientUserId(body.recipientExpertId, body.recipientUserId)
  if (!recipientId || recipientId === session.user.id) {
    return NextResponse.json({ error: "Empfänger nicht gefunden." }, { status: 400 })
  }

  const message = await prisma.directMessage.create({
    data: {
      communicationType: body.communicationType === "MAIL" ? "MAIL" : "CHAT",
      senderId: session.user.id,
      recipientId,
      subject: body.communicationType === "MAIL" ? (typeof body.subject === "string" ? body.subject.trim() : "") : null,
      text: trimmed || "(Anhang)",
      attachmentUrl: hasAttachment ? body.attachmentUrl : null,
      attachmentThumbnailUrl: body.attachmentThumbnailUrl || null,
      attachmentFilename: body.attachmentFilename || null,
    },
  })

  const recipient = await prisma.user.findUnique({
    where: { id: recipientId },
    select: { name: true, email: true },
  })
  const senderName = session.user.name ?? "Jemand"

  if (body.communicationType === "CHAT") {
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
    // Link zur Waymail-Inbox des Empfängers (recipientId), nicht des Absenders
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
})

/** PATCH — Waymail als gelesen markieren */
export const PATCH = apiHandler(async (req: NextRequest) => {
  const authResult = await requireAuth()
  if (authResult.response) return authResult.response
  const session = authResult.session

  const waymailId = req.nextUrl.searchParams.get("waymail")
  if (!waymailId) {
    return NextResponse.json({ error: "waymail id fehlt." }, { status: 400 })
  }

  const wm = await prisma.directMessage.findFirst({
    where: { id: waymailId, recipientId: session.user.id, communicationType: "MAIL" },
  })
  if (!wm) return NextResponse.json({ error: "Waymail nicht gefunden." }, { status: 404 })
  await prisma.directMessage.update({ where: { id: wm.id }, data: { read: true } })
  return NextResponse.json({ ok: true })
})
