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
 * Anonymisiert einen User (DSGVO-konform).
 * - Name, E-Mail, Bild, Passwort, Rechnungsdaten werden ersetzt.
 * - Wallet-Historie bleibt erhalten (User-Record bleibt).
 * - Buchungshistorie wird anonymisiert (§ 147 AO).
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

  const anonName = ANON_NAME(userId)
  const anonEmail = ANON_EMAIL(userId)
  const randomPassword = await bcrypt.hash(`anon_${userId}_${Date.now()}_${Math.random()}`, 10)

  await prisma.$transaction(async (tx) => {
    // 1. Buchungen: User als Shugyo (Zahler)
    await tx.booking.updateMany({
      where: { userId },
      data: { userName: anonName, userEmail: anonEmail },
    })

    // 2. Buchungen: User als Takumi (Experte) — über Expert
    if (user.expert) {
      await tx.booking.updateMany({
        where: { expertId: user.expert!.id },
        data: { expertName: anonName, expertEmail: anonEmail },
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
          isLive: false,
          liveStatus: "offline",
        },
      })
    }

    // 6. User anonymisieren — Record bleibt (Wallet-Historie!)
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
        invoiceData: Prisma.DbNull,
        favorites: [],
        status: "paused",
        isVerified: false,
        verificationSource: "NONE",
      },
    })
  })

  return { ok: true, imageUrls }
}
