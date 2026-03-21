import { PrismaClient } from "@prisma/client"
import { withAccelerate } from "@prisma/extension-accelerate"

/**
 * Prisma Client Singleton — verhindert Connection Exhaustion in Serverless.
 *
 * - Development: Verhindert Hot-Reload-Verbindungslecks (nur eine Instanz pro Prozess).
 * - Production (Vercel): Prisma Accelerate (prisma+postgres://) übernimmt Connection-Pooling.
 *   DATABASE_URL muss die Accelerate-URL sein (aus Prisma Console: PRISMA_DATABASE_URL).
 *   DIRECT_URL = direkte Postgres-URL (aus Prisma Console: POSTGRES_URL) — nur für Migrationen.
 */

function createPrismaClient() {
  const isAccelerate = process.env.DATABASE_URL?.startsWith("prisma+postgres://")
  const client = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  })
  return isAccelerate ? client.$extends(withAccelerate()) : client
}

const globalForPrisma = global as unknown as { prisma: ReturnType<typeof createPrismaClient> }

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

globalForPrisma.prisma = prisma
