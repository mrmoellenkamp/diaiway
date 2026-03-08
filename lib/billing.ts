"use server"

import { prisma } from "@/lib/db"

export type DocType = "RE" | "GS" | "SR" | "SG" | "KD"

const INITIAL_VALUES: Record<DocType, number> = {
  KD: 9999,   // first = 10000
  RE: 100000, // first = 100001
  GS: 100000,
  SR: 100000,
  SG: 100000,
}

/** Atomare Vergabe der nächsten Belegnummer (RE-100001, GS-100001, KD-10000, etc.) */
export async function getNextDocumentNumber(type: DocType): Promise<string> {
  const result = await prisma.$transaction(async (tx) => {
    const row = await tx.invoiceCounter.upsert({
      where: { type },
      create: { type, value: INITIAL_VALUES[type] },
      update: { value: { increment: 1 } },
    })
    return row.value
  })
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
