import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/db"
import { rateLimit } from "@/lib/rate-limit"

export const { handlers, signIn, signOut, auth } = NextAuth({
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

        // Rate limit: 10 failed attempts per email per 15 min
        const rl = rateLimit(`login:${email}`, { limit: 10, windowSec: 900 })
        if (!rl.success) {
          // Throw so NextAuth surfaces the error to the client
          throw new Error(`TOO_MANY_ATTEMPTS:${rl.retryAfterSec}`)
        }

        const user = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true, email: true, password: true, role: true, appRole: true, status: true, image: true, isBanned: true, isVerified: true } })
        if (!user) return null
        if ((user as { isBanned?: boolean }).isBanned) return null // diaiway Safety: gesperrte Nutzer

        const isValid = await bcrypt.compare(credentials.password as string, user.password)
        if (!isValid) return null

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          appRole: user.appRole,
          status: (user as { status?: string }).status ?? "active",
          image: user.image || "",
          isVerified: (user as { isVerified?: boolean }).isVerified ?? false,
        }
      },
    }),
  ],

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60,   // refresh token once per day
  },

  pages: { signIn: "/login" },

  callbacks: {
    async jwt({ token, user, trigger, session: updateData }) {
      // 1. Initialer Login
      if (user) {
        token.id         = user.id
        token.role       = (user as { role?: string }).role       || "user"
        token.appRole    = (user as { appRole?: string }).appRole  || "shugyo"
        token.status     = (user as { status?: string }).status   || "active"
        token.isVerified = (user as { isVerified?: boolean }).isVerified ?? false
      }

      // 2. Client-initiiertes Session-Update (updateSession)
      if (trigger === "update" && updateData) {
        if (updateData.name)       token.name       = updateData.name
        if (updateData.image)      token.picture    = updateData.image
        if (updateData.status)     token.status     = updateData.status
        if (typeof updateData.isVerified === "boolean") token.isVerified = updateData.isVerified
        // Anti-Privilege-Escalation: appRole → takumi nur wenn Expert-Record existiert
        if (updateData.appRole === "takumi") {
          const userId = (token.id as string) ?? (token.sub as string)
          if (userId) {
            const expert = await prisma.expert.findUnique({
              where: { userId },
              select: { id: true },
            })
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
          const dbUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { role: true, appRole: true, status: true, tokenRevocationTime: true },
          })
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

          // P1.3: Rollen-Sync (Änderungen durch Admin greifen ohne Relogin)
          token.role = dbUser.role
          token.appRole = dbUser.appRole
          token.status = dbUser.status
          token.dbSyncedAt = now
        } catch (err) {
          console.error("[auth] DB-Sync-Error:", err)
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
        if (token.name)    session.user.name  = token.name    as string
        if (token.picture) session.user.image = token.picture as string
      }
      return session
    },
  },
})
