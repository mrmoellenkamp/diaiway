import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { isDbConnectionError } from "@/lib/is-db-connection-error"

/**
 * Admin-Layout: Strikte Zugriffskontrolle für alle /admin/* Routen.
 * Kein Sidebar – Navigation liegt im jeweiligen Page-Component.
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

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })
    if (!dbUser || dbUser.role !== "admin") {
      redirect("/home")
    }
  } catch (err: unknown) {
    if (!isDbConnectionError(err)) throw err
    const name = err instanceof Error ? err.constructor.name : ""
    const msg = err instanceof Error ? err.message : ""
    console.warn("[AdminLayout] DB-Check übersprungen (Cold Start):", name, msg.slice(0, 120))
  }

  return <>{children}</>
}
