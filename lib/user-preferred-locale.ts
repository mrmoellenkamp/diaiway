import { prisma } from "@/lib/db"
import type { AppLocale } from "@/lib/i18n/types"
import { isAppLocale } from "@/lib/i18n/types"

/**
 * Server-side UI/push language for a user.
 * Synced from the client when the user changes language (see I18nProvider).
 */
export async function getUserPreferredLocale(userId: string): Promise<AppLocale> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { preferredLocale: true },
  })
  const raw = u?.preferredLocale?.trim().toLowerCase()
  if (raw && isAppLocale(raw)) return raw
  return "de"
}
