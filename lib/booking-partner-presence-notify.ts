/**
 * Wenn eine Partei dem Video-Call beitritt: Gegenpart per In-App + Push informieren.
 * Idempotent über Notification.type + bookingId + userId (Empfänger).
 */

import { prisma } from "@/lib/db"
import { sendPushToUser } from "@/lib/push"
import { pushT } from "@/lib/push-strings"
import { getUserPreferredLocale } from "@/lib/user-preferred-locale"
import { communicationUsername } from "@/lib/communication-display"

/** Erste Person hat Session gestartet – Partner noch nicht im Call */
export const NOTIFICATION_TYPE_PARTNER_WAITING_IN_CALL = "booking_partner_waiting_in_call"
/** Zweite Person ist nach aktivem Raum beigetreten */
export const NOTIFICATION_TYPE_PARTNER_JOINED_CALL = "booking_partner_joined_call"

function partnerUserId(
  joiningUserId: string,
  bookerUserId: string,
  expertAccountUserId: string | null | undefined
): string | null {
  if (joiningUserId === bookerUserId) {
    return expertAccountUserId ?? null
  }
  if (expertAccountUserId && joiningUserId === expertAccountUserId) {
    return bookerUserId
  }
  return null
}

async function joinerDisplayName(joiningUserId: string, isBooker: boolean): Promise<string> {
  const u = await prisma.user.findUnique({
    where: { id: joiningUserId },
    select: { username: true },
  })
  return communicationUsername(u?.username, isBooker ? "Shugyo" : "Takumi")
}

async function sendOnce(params: {
  bookingId: string
  recipientUserId: string
  type: string
  title: string
  body: string
  url: string
  pushTag: string
}): Promise<void> {
  const existing = await prisma.notification.findFirst({
    where: {
      userId: params.recipientUserId,
      bookingId: params.bookingId,
      type: params.type,
    },
    select: { id: true },
  })
  if (existing) return

  await prisma.notification.create({
    data: {
      userId: params.recipientUserId,
      bookingId: params.bookingId,
      type: params.type,
      title: params.title,
      body: params.body,
    },
  })

  sendPushToUser(params.recipientUserId, {
    title: params.title,
    body: params.body,
    url: params.url,
    tag: params.pushTag,
  }).catch(() => {})
}

/**
 * confirmed → active: erste Person ist im Raum, benachrichtige den anderen Account.
 */
export async function notifyPartnerWaitingInVideoCall(params: {
  bookingId: string
  joiningUserId: string
  bookerUserId: string
  expertAccountUserId: string | null | undefined
}): Promise<void> {
  const recipientId = partnerUserId(
    params.joiningUserId,
    params.bookerUserId,
    params.expertAccountUserId
  )
  if (!recipientId || recipientId === params.joiningUserId) return

  const isBooker = params.joiningUserId === params.bookerUserId
  const name = await joinerDisplayName(params.joiningUserId, isBooker)
  const url = `/session/${params.bookingId}?connecting=1`
  const loc = await getUserPreferredLocale(recipientId)

  await sendOnce({
    bookingId: params.bookingId,
    recipientUserId: recipientId,
    type: NOTIFICATION_TYPE_PARTNER_WAITING_IN_CALL,
    title: pushT(loc, "partnerWaitingTitle"),
    body: pushT(loc, "partnerWaitingBody", { name }),
    url,
    pushTag: `booking-partner-waiting-${params.bookingId}-${recipientId}`,
  })
}

/**
 * Zweite Person ruft start-session bei bereits active: Gegenpart informieren (einmalig).
 */
export async function notifyPartnerJoinedVideoCall(params: {
  bookingId: string
  joiningUserId: string
  bookerUserId: string
  expertAccountUserId: string | null | undefined
}): Promise<void> {
  const recipientId = partnerUserId(
    params.joiningUserId,
    params.bookerUserId,
    params.expertAccountUserId
  )
  if (!recipientId || recipientId === params.joiningUserId) return

  const isBooker = params.joiningUserId === params.bookerUserId
  const name = await joinerDisplayName(params.joiningUserId, isBooker)
  const url = `/session/${params.bookingId}?connecting=1`
  const loc = await getUserPreferredLocale(recipientId)

  await sendOnce({
    bookingId: params.bookingId,
    recipientUserId: recipientId,
    type: NOTIFICATION_TYPE_PARTNER_JOINED_CALL,
    title: pushT(loc, "partnerJoinedTitle"),
    body: pushT(loc, "partnerJoinedBody", { name }),
    url,
    pushTag: `booking-partner-joined-${params.bookingId}-${recipientId}`,
  })
}
