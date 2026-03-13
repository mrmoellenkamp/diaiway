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

  // Defense-in-Depth: Rolle aus DB verifizieren (JWT könnte veraltet sein)
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  })
  if (!dbUser || dbUser.role !== "admin") {
    redirect("/home")
  }

  return <>{children}</>
}
