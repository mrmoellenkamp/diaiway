import { PrismaClient } from "@prisma/client"

/**
 * Prisma Client Singleton — verhindert Connection Exhaustion in Serverless.
 *
 * - Development: Verhindert Hot-Reload-Verbindungslecks (nur eine Instanz pro Prozess).
 * - Production (Vercel): Jede Lambda-Instanz recycelt den Client über global.
 *
 * WICHTIG für Serverless-Betrieb: DATABASE_URL sollte den Pooler nutzen:
 *   ?pgbouncer=true&connection_limit=1
 * Siehe .env.example für Details.
 */
const globalForPrisma = global as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  })

globalForPrisma.prisma = prisma
