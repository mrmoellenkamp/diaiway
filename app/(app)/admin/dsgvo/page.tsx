"use client"

import { useSession } from "next-auth/react"
import { redirect } from "next/navigation"
import DSGVOReport from "@/components/dsgvo-report"

export default function DSGVOPage() {
  const { data: session, status } = useSession()
  if (status === "loading") return null
  const user = session?.user as { role?: string } | undefined
  if (!user || user.role !== "admin") redirect("/")

  return <DSGVOReport />
}
