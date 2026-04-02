import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/db"
import { rateLimit } from "@/lib/rate-limit"
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library"

const TRANSIENT_DB_ERROR_CODES = new Set(["P1001", "P1002", "P2024", "P2037"])

function isTransientDbError(err: unknown): boolean {
  if (err instanceof PrismaClientKnownRequestError) {
    return TRANSIENT_DB_ERROR_CODES.has(err.code)
  }
  if (err instanceof Error) {
    const m = err.message.toLowerCase()
    return (
      m.includes("can't reach database server") ||
      m.includes("connection timeout") ||
      m.includes("timed out") ||
      m.includes("connection closed") ||
      m.includes("too many connections")
    )
  }
  return false
}

async function withDbRetry<T>(task: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await task()
    } catch (err) {
      lastErr = err
      if (!isTransientDbError(err) || i === attempts - 1) {
        throw err
      }
      const backoffMs = 150 * (i + 1)
      await new Promise((resolve) => setTimeout(resolve, backoffMs))
    }
  }
  throw lastErr
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  // Vercel / Reverse-Proxy: Host-Header vertrauen — sonst können Auth-URLs/Cookies inkonsistent sein
  trustHost: true,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "E-Mail", type: "email" },
        password: { label: "Passwort", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const email = (credentials.email as string).toLowerCase().trim()

        try {
          // Rate limit: 10 failed attempts per email per 15 min
          const rl = await rateLimit(`login:${email}`, { limit: 10, windowSec: 900 })
          if (!rl.success) {
            throw new Error(`TOO_MANY_ATTEMPTS:${rl.retryAfterSec}`)
          }

          const user = await withDbRetry(() =>
            prisma.user.findUnique({
              where: { email },
              select: { id: true, name: true, username: true, email: true, password: true, role: true, appRole: true, status: true, image: true, isBanned: true, isVerified: true, emailConfirmedAt: true },
            })
          )
          if (!user) return null
          if ((user as { isBanned?: boolean }).isBanned) return null

          const isValid = await bcrypt.compare(credentials.password as string, user.password)
          if (!isValid) return null

          const emailConfirmedAt = (user as { emailConfirmedAt?: Date | null }).emailConfirmedAt
          return {
            id: user.id,
            name: user.name,
            username: (user as { username?: string | null }).username ?? null,
            email: user.email,
            role: user.role,
            appRole: user.appRole,
            status: (user as { status?: string }).status ?? "active",
            image: user.image || "",
            isVerified: (user as { isVerified?: boolean }).isVerified ?? false,
            emailConfirmedAt: emailConfirmedAt ? emailConfirmedAt.getTime() : null,
          }
        } catch (err) {
          // TOO_MANY_ATTEMPTS weitergeben (bewusst geworfener Fehler)
          if (err instanceof Error && err.message.startsWith("TOO_MANY_ATTEMPTS")) {
            throw err
          }
          // DB-Verbindungsfehler (z.B. Prisma P1001) → Nutzer NICHT ausloggen/sperren
          console.error("[auth] authorize DB-Error:", err)
          throw new Error("DB_ERROR")
        }
      },
    }),
  ],

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60,   // refresh token once per day
  },

  // Persistent cookie so WKWebView (iOS) keeps the session across app restarts.
  // Must use authjs.session-token (Auth.js v5 default) so middleware recognizes the session.
  cookies: {
    sessionToken: {
      name:
        process.env.NODE_ENV === "production"
          ? "__Secure-authjs.session-token"
          : "authjs.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax" as const,
        path: "/",
        secure: process.env.NODE_ENV === "production",
        maxAge: 30 * 24 * 60 * 60, // 30 days – must match session.maxAge
      },
    },
  },

  pages: { signIn: "/login" },

  callbacks: {
    async jwt({ token, user, trigger, session: updateData }) {
      // 1. Initialer Login
      if (user) {
        token.id               = user.id
        token.role             = (user as { role?: string }).role       || "user"
        token.appRole          = (user as { appRole?: string }).appRole  || "shugyo"
        token.status           = (user as { status?: string }).status   || "active"
        token.isVerified       = (user as { isVerified?: boolean }).isVerified ?? false
        token.username        = (user as { username?: string | null }).username ?? null
        token.emailConfirmedAt = (user as { emailConfirmedAt?: number | null }).emailConfirmedAt ?? null
        const img = (user as { image?: string | null }).image?.trim()
        if (img) token.picture = img
      }

      // 2. Client-initiiertes Session-Update (updateSession)
      if (trigger === "update" && updateData) {
        if (updateData.name !== undefined)     token.name     = updateData.name
        if (updateData.username !== undefined) token.username = updateData.username
        if (updateData.image !== undefined) {
          const trimmed = typeof updateData.image === "string" ? updateData.image.trim() : ""
          token.picture = trimmed || undefined
        }
        if (updateData.status)     token.status     = updateData.status
        if (typeof updateData.isVerified === "boolean") token.isVerified = updateData.isVerified
        if (updateData.emailConfirmedAt !== undefined) token.emailConfirmedAt = updateData.emailConfirmedAt
        // Anti-Privilege-Escalation: appRole → takumi nur wenn Expert-Record existiert
        if (updateData.appRole === "takumi") {
          const userId = (token.id as string) ?? (token.sub as string)
          if (userId) {
            const expert = await withDbRetry(() =>
              prisma.expert.findUnique({
                where: { userId },
                select: { id: true },
              })
            )
            if (expert) {
              token.appRole = "takumi"
            } else {
              token.appRole = "shugyo"
              console.warn("[auth] Privilege-Escalation blockiert: userId=%s versuchte appRole=takumi ohne Expert-Record", userId)
            }
          } else {
            token.appRole = "shugyo"
          }
        } else if (updateData.appRole === "shugyo") {
          token.appRole = "shugyo"
        }
      }

      // 3. DB-Sync: Revocation-Check + Rollen-Sync (Admin-Änderungen greifen sofort)
      // Nur alle 5 Minuten, nicht bei jeder Session-Anfrage – schützt vor DB-Überlastung
      const DB_SYNC_INTERVAL_SEC = 5 * 60
      const now = Math.floor(Date.now() / 1000)
      const lastSynced = (token.dbSyncedAt as number) ?? 0
      const userId = (token.id as string) ?? (token.sub as string)
      if (userId && now - lastSynced >= DB_SYNC_INTERVAL_SEC) {
        try {
          const dbUser = await withDbRetry(() =>
            prisma.user.findUnique({
              where: { id: userId },
              select: { role: true, appRole: true, status: true, tokenRevocationTime: true, emailConfirmedAt: true, image: true },
            })
          )
          if (!dbUser) {
            token.id = undefined
            token.error = "SessionRevoked"
            return token
          }

          // P0.2: Session Revocation Check
          const tokenIssuedAt = (token.iat as number) ?? 0
          if (dbUser.tokenRevocationTime != null && tokenIssuedAt < dbUser.tokenRevocationTime) {
            token.id = undefined
            token.error = "SessionRevoked"
            return token
          }

          // P1.3: Rollen-Sync + E-Mail-Verifizierung
          token.role = dbUser.role
          token.appRole = dbUser.appRole
          token.status = dbUser.status
          token.emailConfirmedAt = dbUser.emailConfirmedAt ? dbUser.emailConfirmedAt.getTime() : null
          const syncedImg = dbUser.image?.trim()
          token.picture = syncedImg || undefined
          token.dbSyncedAt = now
        } catch (err) {
          // Transiente DB-Ausfälle: kurze Warnung statt vollem Stack (sonst Log-Spam bei P1001 / Neon-Pooler)
          if (isTransientDbError(err)) {
            console.warn("[auth] DB-Sync übersprungen (Datenbank vorübergehend nicht erreichbar)")
          } else {
            console.error("[auth] DB-Sync-Error:", err)
          }
          // Bei DB-Fehler: bestehende Token-Daten beibehalten, kein sync-Timestamp setzen
          // → nächster Request versucht es erneut
        }
      }

      return token
    },
    async session({ session, token }) {
      if ((token as { error?: string }).error === "SessionRevoked") {
        return { ...session, user: { ...session.user, id: undefined } }
      }
      if (session.user) {
        (session.user as { role?: string }).role       = token.role    as string
        ;(session.user as { appRole?: string }).appRole = token.appRole as string
        ;(session.user as { status?: string }).status     = token.status     as string
        ;(session.user as { id?: string }).id             = token.id        as string
        ;(session.user as { isVerified?: boolean }).isVerified = token.isVerified as boolean ?? false
        ;(session.user as { username?: string | null }).username = (token.username as string | null) ?? null
        ;(session.user as { emailConfirmedAt?: number | null }).emailConfirmedAt = (token.emailConfirmedAt as number | null) ?? null
        if (token.name) session.user.name = token.name as string
        ;(session.user as { image?: string | null }).image =
          typeof token.picture === "string" && token.picture.trim() !== ""
            ? token.picture
            : ""
      }
      return session
    },
  },
})
