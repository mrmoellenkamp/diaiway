"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { CheckCircle, Loader2, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export default function VerifyEmailSuccessPage() {
  const router = useRouter()
  const { data: session, status, update: updateSession } = useSession()
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    if (status !== "authenticated" || !session?.user) return

    const emailConfirmedAt = (session.user as { emailConfirmedAt?: number | null }).emailConfirmedAt
    if (emailConfirmedAt) {
      router.replace("/onboarding")
      return
    }

    setUpdating(true)
    updateSession({ emailConfirmedAt: Date.now() })
      .then(() => {
        router.replace("/onboarding")
      })
      .catch(() => {
        router.replace("/login?callbackUrl=/onboarding&verified=1")
      })
      .finally(() => setUpdating(false))
  }, [status, session, router, updateSession])

  return (
    <div className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-md">
        <Card className="overflow-hidden border-border/60">
          <CardHeader className="border-b border-border/40 bg-muted/20 pb-6">
            <div className="flex items-center justify-center">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-green-500/10">
                <CheckCircle className="size-7 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <h1 className="mt-4 text-center text-xl font-bold text-foreground">
              E-Mail bestätigt!
            </h1>
            <p className="mt-1 text-center text-sm text-muted-foreground">
              Dein Konto ist aktiv. Weiter geht's mit dem Onboarding.
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 pt-6">
            {updating || status === "loading" ? (
              <div className="flex items-center justify-center gap-2 py-6">
                <Loader2 className="size-5 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Weiterleitung...</span>
              </div>
            ) : (
              <Button asChild className="w-full gap-2 rounded-xl" size="lg">
                <Link href={status === "authenticated" ? "/onboarding" : "/login?callbackUrl=/onboarding"}>
                  Zum Onboarding
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
