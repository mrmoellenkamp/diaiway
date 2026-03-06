"use client"

import { useState } from "react"
import { signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { PauseCircle, Loader2, LogOut } from "lucide-react"
import { toast } from "sonner"

export default function PausedPage() {
  const [resuming, setResuming] = useState(false)

  async function handleResume() {
    setResuming(true)
    try {
      const res = await fetch("/api/user/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resume" }),
      })
      if (res.ok) {
        toast.success("Konto reaktiviert.")
        window.location.href = "/home"
      } else {
        toast.error("Fehler beim Reaktivieren.")
      }
    } finally {
      setResuming(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-yellow-500/10 mb-6">
        <PauseCircle className="size-8 text-yellow-500" />
      </div>
      <h1 className="text-2xl font-bold text-foreground mb-2">Konto pausiert</h1>
      <p className="text-sm text-muted-foreground max-w-sm mb-8 leading-relaxed">
        Dein Konto ist aktuell pausiert. Du kannst es jederzeit reaktivieren und
        sofort weitermachen — alle deine Daten sind erhalten geblieben.
      </p>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Button onClick={handleResume} disabled={resuming} className="h-12 gap-2 rounded-xl">
          {resuming ? <Loader2 className="size-4 animate-spin" /> : <PauseCircle className="size-4" />}
          Konto reaktivieren
        </Button>
        <Button
          variant="ghost"
          className="h-11 gap-2 text-muted-foreground"
          onClick={() => signOut({ callbackUrl: "/" })}
        >
          <LogOut className="size-4" />
          Abmelden
        </Button>
      </div>
    </div>
  )
}
