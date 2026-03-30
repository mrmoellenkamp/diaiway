"use server"

import { prisma } from "@/lib/db"

export type DocType = "RE" | "GS" | "SR" | "SG" | "KD" | "PR" | "GBL"

const INITIAL_VALUES: Record<DocType, number> = {
  /**
   * Erste Kundennummer im UI: KD-00001 (Formatierung mit padStart im Code).
   * In `InvoiceCounter` steht nur eine **ganze Zahl** (1, 2, 3 …), keine Zeichenkette "00001".
   * Nächste Vergabe = KD-00001 erzwingen (bestehende Zeile): `UPDATE "InvoiceCounter" SET value = 0 WHERE type = 'KD';`
   * (0 = „noch keine vergeben“; beim nächsten Aufruf wird hochgezählt auf 1.)
   * Siehe auch `docs/kundennummer-zaehler.md`.
   */
  KD: 1,
  RE: 100000, // first = 100001
  GS: 100000,
  SR: 100000,
  SG: 100000,
  PR: 100000,
  /** Guthaben-Einzahlungsbeleg (ersetzt die frühere Wallet-Rechnung RE-WALLET) */
  GBL: 100000,
}

/** Atomare Vergabe der nächsten Belegnummer (RE-100001, GS-100001, KD-00001, …) */
export async function getNextDocumentNumber(type: DocType): Promise<string> {
  const result = await prisma.$transaction(async (tx) => {
    const row = await tx.invoiceCounter.upsert({
      where: { type },
      create: { type, value: INITIAL_VALUES[type] },
      update: { value: { increment: 1 } },
    })
    return row.value
  })
  if (type === "KD") {
    return `KD-${String(result).padStart(5, "0")}`
  }
  return `${type}-${result}`
}

/** Weist einem User eine Kundennummer zu, falls noch keine vorhanden */
export async function ensureCustomerNumber(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { customerNumber: true },
  })
  if (user?.customerNumber) return user.customerNumber

  const customerNumber = await getNextDocumentNumber("KD")
  await prisma.user.update({
    where: { id: userId },
    data: { customerNumber },
  })
  return customerNumber
}
