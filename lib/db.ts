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

function isTransientDbError(err: unknown): boolean {
  const e = err as any
  const code: string | undefined = e?.code
  const msg: string = typeof e?.message === "string" ? e.message : ""
  if (code && ["P1001", "P1002", "P2024", "P2037"].includes(code)) return true
  const lower = msg.toLowerCase()
  if (lower.includes("can't reach database server") || lower.includes("unable to connect")) return true
  return false
}

const READ_ACTIONS = new Set([
  "findUnique",
  "findFirst",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
])

function buildClient() {
  const base = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  })

  return base.$extends({
    query: {
      $allModels: {
        async $allOperations({ operation, args, query }: any) {
          if (!READ_ACTIONS.has(operation)) return query(args)

          const maxAttempts = 3
          let lastErr: unknown
          for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
              return await query(args)
            } catch (err) {
              lastErr = err
              if (!isTransientDbError(err) || attempt === maxAttempts - 1) throw err
              const backoff = 200 * Math.pow(2, attempt) // 200ms, 400ms, 800ms
              await new Promise((r) => setTimeout(r, backoff + Math.floor(Math.random() * 80)))
            }
          }
          throw lastErr
        },
      },
    },
  }) as unknown as PrismaClient
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? buildClient()

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
}
