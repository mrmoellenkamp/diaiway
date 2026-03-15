/**
 * One-off script: Set emailConfirmedAt = createdAt for existing users
 * who registered before the Double Opt-In was introduced.
 * Run: npx tsx scripts/grandfather-email-verification.ts
 */
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  // Nur User OHNE Verifizierungs-Token = vor Double-Opt-In registriert
  const updated = await prisma.$executeRaw`
    UPDATE "User"
    SET "emailConfirmedAt" = "createdAt"
    WHERE "emailConfirmedAt" IS NULL
      AND "emailVerificationToken" IS NULL
      AND "emailVerificationExpiry" IS NULL
  `

  console.log(`Grandfathered ${updated} existing users (emailConfirmedAt = createdAt)`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
