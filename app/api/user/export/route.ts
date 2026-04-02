import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export const runtime = "nodejs"

/**
 * GET /api/user/export
 * DSGVO Art. 20 – Datenportabilität: Maschinenlesbarer Export aller beim Nutzer
 * gespeicherten personenbezogenen Daten als JSON.
 *
 * Enthält: Profil, Buchungen, Nachrichten (als Sender), Wallet-Bewegungen,
 * Projekte, Einwilligungsnachweise, Benachrichtigungshistorie.
 * Nicht enthalten: interne Logs, Admin-Aktionen, aggregierte Analytics-Daten
 * ohne Personenbezug.
 */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 })
  }
  const userId = session.user.id

  const [user, bookings, messages, walletTransactions, shugyoProjects, takumiProjects, notifications] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          name: true,
          username: true,
          email: true,
          appRole: true,
          status: true,
          skillLevel: true,
          languages: true,
          preferredLocale: true,
          createdAt: true,
          // Einwilligungsnachweise
          acceptedAgbVersion: true,
          acceptedAgbAt: true,
          acceptedPrivacyVersion: true,
          acceptedPrivacyAt: true,
          earlyPerformanceWaiverAt: true,
          paymentProcessorConsentAt: true,
          takumiExpertDeclarationAt: true,
          marketingOptIn: true,
          marketingOptInAt: true,
          marketingDoubleOptInAt: true,
          // Rechnungsadresse (falls gesetzt)
          invoiceData: true,
          // Expert-Profil (falls Takumi)
          expert: {
            select: {
              name: true,
              email: true,
              bio: true,
              categorySlug: true,
              categoryName: true,
              subcategory: true,
              priceVideo15Min: true,
              priceVoice15Min: true,
              rating: true,
              reviewCount: true,
              sessionCount: true,
              joinedDate: true,
              socialLinks: true,
              createdAt: true,
            },
          },
        },
      }),
      prisma.booking.findMany({
        where: { userId },
        select: {
          id: true,
          date: true,
          startTime: true,
          endTime: true,
          status: true,
          callType: true,
          bookingMode: true,
          paymentStatus: true,
          totalPrice: true,
          note: true,
          createdAt: true,
          expert: { select: { name: true, categoryName: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
      prisma.directMessage.findMany({
        where: { senderId: userId },
        select: {
          communicationType: true,
          subject: true,
          text: true,
          createdAt: true,
          recipient: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
      prisma.walletTransaction.findMany({
        where: { userId },
        select: {
          type: true,
          amountCents: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
      prisma.shugyoProject.findMany({
        where: { userId },
        select: { title: true, description: true, imageUrl: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.takumiPortfolioProject.findMany({
        where: { userId },
        select: {
          title: true,
          description: true,
          category: true,
          completionDate: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.notification.findMany({
        where: { userId },
        select: { type: true, title: true, body: true, read: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
    ])

  const exportData = {
    _meta: {
      exportedAt: new Date().toISOString(),
      exportedBy: userId,
      gdprBasis: "Art. 20 DSGVO – Recht auf Datenübertragbarkeit",
      note: "Dieser Export enthält alle beim Nutzer gespeicherten personenbezogenen Daten in maschinenlesbarem Format.",
    },
    profile: user,
    bookings,
    sentMessages: messages,
    walletTransactions,
    shugyoProjects,
    takumiPortfolioProjects: takumiProjects,
    notifications,
  }

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="diaiway-datenexport-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  })
}
