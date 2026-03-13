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
      if (user) {
        token.role       = (user as { role?: string }).role       || "user"
        token.appRole    = (user as { appRole?: string }).appRole  || "shugyo"
        token.status     = (user as { status?: string }).status     || "active"
        token.id         = user.id
        token.isVerified = (user as { isVerified?: boolean }).isVerified ?? false
      }
      if (trigger === "update" && updateData) {
        if (updateData.name)       token.name       = updateData.name
        if (updateData.image)      token.picture    = updateData.image
        if (updateData.appRole)    token.appRole    = updateData.appRole
        if (updateData.status)     token.status     = updateData.status
        if (typeof updateData.isVerified === "boolean") token.isVerified = updateData.isVerified
      }
      return token
    },
    async session({ session, token }) {
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
