/**
 * Einmal-Skript: Kundennummer für einen User setzen (z. B. KD-00001).
 *
 * Ausführen (lokal / mit gültiger DATABASE_URL in .env):
 *   npx tsx scripts/set-customer-number.ts
 *   npx tsx scripts/set-customer-number.ts andere@email.de KD-00002
 */
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const email = process.argv[2] ?? "jm@faircharge.com"
  const customerNumber = process.argv[3] ?? "KD-00001"

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    console.error(`Kein User mit E-Mail: ${email}`)
    process.exit(1)
  }

  const conflict = await prisma.user.findFirst({
    where: {
      customerNumber,
      NOT: { id: user.id },
    },
    select: { email: true },
  })
  if (conflict) {
    console.error(`Kundennummer ${customerNumber} ist bereits vergeben an: ${conflict.email}`)
    process.exit(1)
  }

  const n = /^KD-(\d+)$/.exec(customerNumber)
  const seq = n ? parseInt(n[1], 10) : null
  if (!seq || Number.isNaN(seq)) {
    console.error(`Ungültiges Format (erwartet z. B. KD-00001): ${customerNumber}`)
    process.exit(1)
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { customerNumber },
  })

  const row = await prisma.invoiceCounter.findUnique({ where: { type: "KD" } })
  const prev = row?.value ?? 0
  const nextCounter = Math.max(prev, seq)

  await prisma.invoiceCounter.upsert({
    where: { type: "KD" },
    create: { type: "KD", value: nextCounter },
    update: { value: nextCounter },
  })

  console.log(`OK: ${email} → ${customerNumber}`)
  console.log(`InvoiceCounter KD value = ${nextCounter} (nächste automatische Vergabe: KD-${String(nextCounter + 1).padStart(5, "0")})`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
