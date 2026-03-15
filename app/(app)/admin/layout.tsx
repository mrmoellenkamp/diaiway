import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

/**
 * Admin-Layout: Strikte Zugriffskontrolle für alle /admin/* Routen.
 * Entkoppelt vom Profil-Kontext – Admin ist eigenständiger Bereich.
 * Prüfung: NextAuth Session + optional Prisma-Rolle für Defense-in-Depth.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/admin")
  }

  const role = (session.user as { role?: string })?.role
  if (role !== "admin") {
    redirect("/home")
  }

  // Defense-in-Depth: Rolle aus DB verifizieren (JWT könnte veraltet sein).
  // Neon/Prisma-Cold-Start wirft PrismaClientInitializationError ("Can't reach database server").
  // In diesem Fall reicht der JWT-Admin-Check oben als Fallback – nicht crashen.
  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })
    if (!dbUser || dbUser.role !== "admin") {
      redirect("/home")
    }
  } catch (err: unknown) {
    const name = err instanceof Error ? err.constructor.name : ""
    const msg  = err instanceof Error ? err.message : ""

    const isConnectionError =
      name === "PrismaClientInitializationError" ||
      name === "PrismaClientKnownRequestError" && (err as { code?: string }).code === "P1001" ||
      msg.includes("Can't reach database") ||
      msg.includes("ECONNREFUSED") ||
      msg.includes("connect ETIMEDOUT")

    if (!isConnectionError) throw err

    // DB momentan nicht erreichbar (Cold Start) – JWT-Rollenprüfung hat bereits bestätigt: admin
    console.warn("[AdminLayout] DB-Check übersprungen (Cold Start):", name, msg.slice(0, 120))
  }

  return <>{children}</>
}
