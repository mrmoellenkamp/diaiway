import { redirect } from "next/navigation"
import { getDashboardData } from "@/lib/dashboard-data"
import { DashboardClient } from "@/components/dashboard-client"

/**
 * Dashboard — dual layout based on appRole (Shugyo vs Takumi).
 * Server Component: fetches bookings, messages, wallet, etc. server-side.
 */
export default async function DashboardPage() {
  const data = await getDashboardData()
  if (!data) {
    redirect("/login?callbackUrl=/dashboard")
  }

  return <DashboardClient data={data} />
}
