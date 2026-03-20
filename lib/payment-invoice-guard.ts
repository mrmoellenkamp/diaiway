import { prisma } from "@/lib/db"
import { validateInvoiceDataForPayment } from "@/lib/invoice-requirements"

/**
 * Prüft, ob der Shugyo vollständige Rechnungsdaten hat (Pflicht vor Zahlung).
 * @returns Fehlertext oder null wenn ok
 */
export async function getInvoiceIncompleteMessageForUser(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { invoiceData: true },
  })
  const v = validateInvoiceDataForPayment(user?.invoiceData ?? null)
  if (v.ok) return null
  return v.message ?? "Bitte vervollständige zuerst deine Rechnungsdaten."
}

/** Wirft Error mit Nutzertext, wenn Rechnungsdaten fehlen (Server Actions / APIs). */
export async function assertInvoiceCompleteForPayment(userId: string): Promise<void> {
  const msg = await getInvoiceIncompleteMessageForUser(userId)
  if (msg) throw new Error(msg)
}
