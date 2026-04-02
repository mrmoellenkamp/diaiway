"use server"

import bcrypt from "bcryptjs"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"

const ANON_PREFIX = "user_deleted_"
const ANON_SUFFIX = (id: string) => id.slice(-12).replace(/[^a-zA-Z0-9]/g, "_")
const ANON_EMAIL = (id: string) =>
  `${ANON_PREFIX}${ANON_SUFFIX(id)}@anonymized.local`
const ANON_NAME = (id: string) => `${ANON_PREFIX}${ANON_SUFFIX(id)}`

/**
 * Anonymisierter Username: Gibt den ursprünglichen Username frei (@unique) und
 * vermeidet Kollisionen. Format: deleted_user_{userId}_{timestamp}
 * Max. Länge: ~52 Zeichen (Postgres TEXT, keine App-Limitierung).
 */
function anonUsername(userId: string): string {
  const ts = Date.now()
  return `deleted_user_${userId}_${ts}`
}

/** Prüft, ob eine URL ein Vercel-Blob ist. */
function isBlobUrl(url: string): boolean {
  return (
    typeof url === "string" &&
    url.length > 0 &&
    (url.includes("blob.vercel-storage.com") || url.includes("vercel-storage.com"))
  )
}

/**
 * Anonymisiert einen User (DSGVO Art. 17 i. V. m. Speicherbegrenzung / Rechtsgrundlagen).
 * - Identifikatoren, Profil, Chat/Waymail, Projekte, Push, In-App-Benachrichtigungen,
 *   Buchungsfreitexte und Analytics-Verknüpfung werden entfernt bzw. minimiert.
 * - Wallet- und Buchungsstammdaten (Beträge, Status, anonymisierte Namen) bleiben,
 *   soweit Aufbewahrungspflichten (z. B. § 147 AO) entgegenstehen.
 * - Stripe Connect (Takumi): Konto-ID bleibt bis manuelle Klärung mit Stripe/Aufbewahrung;
 *   Profil-PII am Expert wird entfernt.
 *
 * @returns { imageUrls: string[] } - Blob-URLs zum physischen Löschen (außerhalb Transaction)
 * @throws niemals – bei Fehler { ok: false, error }
 */
export async function anonymizeUser(userId: string): Promise<
  | { ok: true; imageUrls: string[] }
  | { ok: false; error: string }
> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { expert: true },
  })

  if (!user) {
    return { ok: false, error: "Nutzer nicht gefunden." }
  }

  if (user.role === "admin") {
    return { ok: false, error: "Admin-Konten können aus Sicherheitsgründen nicht gelöscht werden." }
  }

  const imageUrls: string[] = []
  if (user.image && isBlobUrl(user.image)) imageUrls.push(user.image)
  if (user.expert?.avatar && isBlobUrl(user.expert.avatar)) imageUrls.push(user.expert.avatar)
  if (user.expert?.imageUrl && isBlobUrl(user.expert.imageUrl)) imageUrls.push(user.expert.imageUrl)
  for (const url of user.expert?.portfolio ?? []) {
    if (url && isBlobUrl(url)) imageUrls.push(url)
  }

  const shugyoProjects = await prisma.shugyoProject.findMany({
    where: { userId },
    select: { imageUrl: true },
  })
  for (const p of shugyoProjects) {
    if (p.imageUrl && isBlobUrl(p.imageUrl)) imageUrls.push(p.imageUrl)
  }

  const takumiPortfolio = await prisma.takumiPortfolioProject.findMany({
    where: { userId },
    select: { imageUrl: true },
  })
  for (const p of takumiPortfolio) {
    if (p.imageUrl && isBlobUrl(p.imageUrl)) imageUrls.push(p.imageUrl)
  }

  const userMessages = await prisma.directMessage.findMany({
    where: { OR: [{ senderId: userId }, { recipientId: userId }] },
    select: { attachmentUrl: true, attachmentThumbnailUrl: true },
  })
  for (const m of userMessages) {
    if (m.attachmentUrl && isBlobUrl(m.attachmentUrl)) imageUrls.push(m.attachmentUrl)
    if (m.attachmentThumbnailUrl && isBlobUrl(m.attachmentThumbnailUrl)) imageUrls.push(m.attachmentThumbnailUrl)
  }

  // Safety-Incidents: Snapshot-Bilder sammeln (werden nach Transaktion gelöscht)
  // Nur nicht-laufende Incidents (resolved) → bei laufenden Verfahren bleiben Bilder erhalten.
  // DSGVO Art. 17 Abs. 3 lit. b: Daten für Rechtsverfolgung dürfen vorübergehend bleiben.
  const resolvedIncidents = await prisma.safetyIncident.findMany({
    where: {
      booking: { OR: [{ userId }, ...(user.expert ? [{ expertId: user.expert.id }] : [])] },
      resolvedAt: { not: null },
    },
    select: { id: true, imageUrl: true },
  })
  for (const inc of resolvedIncidents) {
    if (inc.imageUrl && isBlobUrl(inc.imageUrl)) imageUrls.push(inc.imageUrl)
  }

  // Transaction-PDFs: Belege haben 10-Jahres-Aufbewahrungspflicht (§§ 147 AO, 257 HGB).
  // PDF-Blobs werden NICHT gelöscht – sie werden ins DocumentArchive überführt.
  // Die URL-Verknüpfung in der Transaction bleibt; Personenbezug wird in Schritt 7
  // ohnehin durch anonymisierten User-Record abgetrennt.

  const anonName = ANON_NAME(userId)
  const anonEmail = ANON_EMAIL(userId)
  const randomPassword = await bcrypt.hash(`anon_${userId}_${Date.now()}_${Math.random()}`, 10)

  await prisma.$transaction(async (tx) => {
    // 0. Kommunikation & Geräte-Tokens (personenbezogene Inhalte / Pseudonyme)
    await tx.directMessage.deleteMany({
      where: { OR: [{ senderId: userId }, { recipientId: userId }] },
    })
    await tx.notification.deleteMany({ where: { userId } })
    await tx.pushSubscription.deleteMany({ where: { userId } })
    await tx.fcmToken.deleteMany({ where: { userId } })
    await tx.shugyoProject.deleteMany({ where: { userId } })
    await tx.takumiPortfolioProject.deleteMany({ where: { userId } })

    // Analytics: Verknüpfung zum Konto lösen (Sessions bleiben aggregiert ohne userId)
    await tx.siteAnalyticsSession.updateMany({
      where: { userId },
      data: { userId: null },
    })

    // 1. Buchungen: User als Shugyo (Zahler) – Namen/E-Mail + Freitexte
    await tx.booking.updateMany({
      where: { userId },
      data: {
        userName: anonName,
        userEmail: anonEmail,
        note: "",
        sessionOpenedByUserId: null,
      },
    })

    // 2. Buchungen: User als Takumi (Experte) — über Expert
    if (user.expert) {
      await tx.booking.updateMany({
        where: { expertId: user.expert!.id },
        data: {
          expertName: anonName,
          expertEmail: anonEmail,
          expertReviewText: null,
          expertRating: null,
        },
      })
    }

    // 2b. SafetyReport: Personenbezug entfernen (reporterId/reportedId → anonymisiert).
    // Einträge bleiben für Plattformintegrität (Buchungs-Verknüpfung), PII wird minimiert.
    await tx.safetyReport.updateMany({
      where: { reporterId: userId },
      data: { reporterId: `anon_${userId}`, details: "" },
    })
    await tx.safetyReport.updateMany({
      where: { reportedId: userId },
      data: { reportedId: `anon_${userId}` },
    })

    // 2c. SafetyIncident: Resolved-Incidents Blob-URL leeren (Bild wird außerhalb TX gelöscht)
    if (resolvedIncidents.length > 0) {
      await tx.safetyIncident.updateMany({
        where: { id: { in: resolvedIncidents.map((i) => i.id) } },
        data: { imageUrl: "" },
      })
    }

    // 3. Reviews (persönliche Meinungen) löschen — von User geschrieben + über Expert
    await tx.review.deleteMany({ where: { userId } })
    if (user.expert) {
      await tx.review.deleteMany({ where: { expertId: user.expert.id } })
    }

    // 4. Verfügbarkeit entfernen
    await tx.availability.deleteMany({ where: { userId } })

    // 5. Expert anonymisieren (falls vorhanden)
    if (user.expert) {
      await tx.expert.update({
        where: { id: user.expert.id },
        data: {
          name: anonName,
          email: anonEmail,
          avatar: "",
          imageUrl: "",
          bio: "",
          bioLive: "",
          portfolio: [],
          socialLinks: {},
          profileRejectionReason: null,
          isLive: false,
          liveStatus: "offline",
        },
      })
    }

    // 6. WalletTransactions: personenbeziehbare Referenzen entfernen.
    // amountCents + type bleiben für Buchhaltung (§ 147 AO). referenceId und
    // metadata können Stripe-Session-IDs, E-Mail-Adressen oder interne Notizen
    // enthalten → null / leeres Objekt (DSGVO Art. 5 Abs. 1 lit. c – Datenminimierung).
    await tx.walletTransaction.updateMany({
      where: { userId },
      data: {
        referenceId: null,
        metadata: Prisma.DbNull,
      },
    })

    // 7. User anonymisieren — Record bleibt (Wallet-Historie!)
    const anonUsernameValue = anonUsername(userId)
    await tx.user.update({
      where: { id: userId },
      data: {
        name: anonName,
        email: anonEmail,
        username: anonUsernameValue, // Gibt ursprünglichen Username frei (@unique)
        password: randomPassword,
        image: "",
        resetToken: null,
        resetTokenExpiry: null,
        emailVerificationToken: null,
        emailVerificationExpiry: null,
        customerNumber: null,
        registrationIpHash: null,
        phase2BillingConsentIpHash: null,
        invoiceData: Prisma.DbNull,
        favorites: [],
        skillLevel: null,
        languages: [],
        status: "paused",
        isVerified: false,
        verificationSource: "NONE",
        marketingOptIn: false,
        marketingOptInAt: null,
        marketingDoubleOptInAt: null,
        moderationViolationAt: null,
        // Einwilligungs-Timestamps nullen (Defence-in-Depth, DSGVO Datenminimierung):
        // Der anonymisierte User-Record bleibt; Timestamps ohne Name/E-Mail sind
        // nicht mehr re-identifizierbar, aber das Nullen verhindert Profilbildung
        // aus Verhaltensmustern (z.B. Zeitpunkt der AGB-Akzeptanz).
        acceptedAgbAt: null,
        acceptedPrivacyAt: null,
        earlyPerformanceWaiverAt: null,
        paymentProcessorConsentAt: null,
        takumiExpertDeclarationAt: null,
        tokenRevocationTime: Math.floor(Date.now() / 1000), // Alle Sessions ungültig
      },
    })
  })

  return { ok: true, imageUrls }
}
