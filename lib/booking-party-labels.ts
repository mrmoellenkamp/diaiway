import { prisma } from "@/lib/db"
import { communicationUsername } from "@/lib/communication-display"

/** Anzeige- / Anrede-Namen für Buchungs-E-Mails und In-App-Texte (nur Username, nie gespeicherter Klartext aus Booking). */
export async function bookingPartyDisplayLabels(booking: { userId: string; expertId: string }): Promise<{
  shugyoLabel: string
  takumiLabel: string
}> {
  const [booker, expert] = await Promise.all([
    prisma.user.findUnique({ where: { id: booking.userId }, select: { username: true } }),
    prisma.expert.findUnique({
      where: { id: booking.expertId },
      select: { user: { select: { username: true } } },
    }),
  ])
  return {
    shugyoLabel: communicationUsername(booker?.username, "Shugyo"),
    takumiLabel: communicationUsername(expert?.user?.username, "Takumi"),
  }
}
