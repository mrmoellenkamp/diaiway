import { PrismaClient } from "@prisma/client"

/**
 * Prisma Client Singleton — verhindert Connection Exhaustion in Serverless.
 * Verwendet Neon's eingebautes Connection-Pooling via DATABASE_URL (pooled endpoint).
 * DIRECT_URL zeigt auf den direkten Neon-Endpoint — nur für Migrationen.
 */

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  })
}

const globalForPrisma = global as unknown as { prisma: ReturnType<typeof createPrismaClient> }

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

globalForPrisma.prisma = prisma
