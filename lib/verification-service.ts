"use server"

import { prisma } from "@/lib/db"

/**
 * Markiert einen User als verifiziert, falls noch nicht.
 * Idempotent: Überschreibt nicht höherwertige Quellen.
 */
export async function markVerified(
  userId: string,
  source: "STRIPE_CONNECT" | "STRIPE_PAYMENT" | "ACTIVITY" | "MANUAL"
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isVerified: true, verificationSource: true },
  })
  if (!user || user.isVerified) return

  await prisma.user.update({
    where: { id: userId },
    data: {
      isVerified: true,
      verificationSource: source,
    },
  })
}
