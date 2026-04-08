"use client"

import { useSession } from "next-auth/react"
import { redirect } from "next/navigation"
import LaunchChecklist from "@/components/launch-checklist"

export default function LaunchPage() {
  const { data: session, status } = useSession()
  if (status === "loading") return null
  const user = session?.user as { role?: string } | undefined
  if (!user || user.role !== "admin") redirect("/")

  return <LaunchChecklist />
}
