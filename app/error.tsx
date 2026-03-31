"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { AlertTriangle, RefreshCcw } from "lucide-react"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log full error in dev; digest helps correlate with server logs in prod
    console.error("[App Error]", {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    })
  }, [error])

  const isDev = process.env.NODE_ENV === "development"

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-6 p-8">
      <div className="flex size-16 items-center justify-center rounded-full bg-[rgba(239,68,68,0.1)]">
        <AlertTriangle className="size-8 text-destructive" />
      </div>
      <div className="flex flex-col items-center gap-2 text-center">
        <h2 className="text-lg font-semibold text-foreground">
          Etwas ist schiefgelaufen
        </h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es erneut.
        </p>
        {isDev && error.message && (
          <pre className="mt-4 max-w-full overflow-auto rounded-lg border border-border bg-[rgba(245,245,244,0.5)] p-4 text-left text-xs text-destructive">
            {error.message}
          </pre>
        )}
        {error.digest && (
          <p className="text-[10px] text-muted-foreground">
            Digest: {error.digest}
          </p>
        )}
      </div>
      <Button onClick={reset} variant="outline" className="gap-2">
        <RefreshCcw className="size-4" />
        Erneut versuchen
      </Button>
    </div>
  )
}
