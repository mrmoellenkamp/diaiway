/**
 * Lightweight Auth.js config for Edge runtime (middleware).
 * No bcrypt, no mongoose -- only JWT callbacks.
 */
import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"

export const { auth: authMiddleware } = NextAuth({
  providers: [
    // Credentials provider stub -- authorize is never called in middleware,
    // but the provider must be declared so the JWT strategy matches.
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      async authorize() {
        // This is never reached in middleware; the real authorize lives in lib/auth.ts
        return null
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: string }).role || "user"
        token.appRole = (user as { appRole?: string }).appRole || "shugyo"
        token.id = user.id
        token.emailConfirmedAt = (user as { emailConfirmedAt?: number | null }).emailConfirmedAt ?? null
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { role?: string }).role = token.role as string
        ;(session.user as { appRole?: string }).appRole = (token.appRole as string) || "shugyo"
        ;(session.user as { id?: string }).id = token.id as string
        ;(session.user as { emailConfirmedAt?: number | null }).emailConfirmedAt = (token.emailConfirmedAt as number | null) ?? null
      }
      return session
    },
  },
})
