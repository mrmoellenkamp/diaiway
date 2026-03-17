import { redirect } from "next/navigation"
import Link from "next/link"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { LayoutDashboard, Scan } from "lucide-react"

/**
 * Admin-Layout: Strikte Zugriffskontrolle für alle /admin/* Routen.
 * Sidebar mit Dashboard und Image Scanner.
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
    const name = err instanceof Error ? err.constructor.name : ""
    const msg  = err instanceof Error ? err.message : ""

    const isConnectionError =
      name === "PrismaClientInitializationError" ||
      name === "PrismaClientKnownRequestError" && (err as { code?: string }).code === "P1001" ||
      msg.includes("Can't reach database") ||
      msg.includes("ECONNREFUSED") ||
      msg.includes("connect ETIMEDOUT")

    if (!isConnectionError) throw err

    console.warn("[AdminLayout] DB-Check übersprungen (Cold Start):", name, msg.slice(0, 120))
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="w-56 shrink-0 border-r border-slate-200 bg-white">
        <div className="flex h-14 items-center border-b border-slate-200 px-4">
          <span className="font-semibold text-slate-800">Admin</span>
        </div>
        <nav className="flex flex-col gap-0.5 p-2">
          <Link
            href="/admin"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            <LayoutDashboard className="size-4 text-slate-500" />
            Dashboard
          </Link>
          <Link
            href="/admin/scanner"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            <Scan className="size-4 text-slate-500" />
            Image Scanner
          </Link>
        </nav>
      </aside>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
