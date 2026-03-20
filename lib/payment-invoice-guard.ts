import { prisma } from "@/lib/db"
import { validateInvoiceDataForPayment } from "@/lib/invoice-requirements"
import { formatInvoiceIncompleteMessage } from "@/lib/i18n/invoice-format"
import { getRequestLocale } from "@/lib/server-locale"
import type { AppLocale } from "@/lib/i18n/types"

export type InvoiceGateFailure = {
  ok: false
  message: string
  missingFieldKeys: string[]
}

export type InvoiceGateResult = { ok: true } | InvoiceGateFailure

/**
 * Zahlungs-Gate: vollständige Rechnungsdaten für den Shugyo.
 * `locale` optional — sonst Cookie / Accept-Language.
 */
export async function getInvoiceGateResult(
  userId: string,
  locale?: AppLocale
): Promise<InvoiceGateResult> {
  const loc = locale ?? (await getRequestLocale())
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { invoiceData: true },
  })
  const v = validateInvoiceDataForPayment(user?.invoiceData ?? null)
  if (v.ok) return { ok: true }
  return {
    ok: false,
    missingFieldKeys: [...v.missingFieldKeys],
    message: formatInvoiceIncompleteMessage(loc, v.missingFieldKeys),
  }
}

/** @returns Fehlertext oder null */
export async function getInvoiceIncompleteMessageForUser(
  userId: string,
  locale?: AppLocale
): Promise<string | null> {
  const r = await getInvoiceGateResult(userId, locale)
  return r.ok ? null : r.message
}

export async function assertInvoiceCompleteForPayment(userId: string, locale?: AppLocale): Promise<void> {
  const r = await getInvoiceGateResult(userId, locale)
  if (!r.ok) throw new Error(r.message)
}
