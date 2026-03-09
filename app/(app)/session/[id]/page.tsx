"use client"

import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/lib/i18n"

export default function SessionCallPage() {
  const params = useParams()
  const router = useRouter()
  const { t } = useI18n()
  const bookingId = params.id as string

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4">
      <p className="text-center text-muted-foreground">Session</p>
      <p className="text-center text-sm text-muted-foreground">ID: {bookingId}</p>
      <Button variant="outline" onClick={() => router.push("/sessions")}>
        {t("sessions.backToSessions")}
      </Button>
    </div>
  )
}
