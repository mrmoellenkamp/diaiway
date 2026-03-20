"use client"

import { useState } from "react"
import Link from "next/link"
import { useSession, signOut } from "next-auth/react"
import { PageContainer } from "@/components/page-container"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { ArrowLeft, PauseCircle, Trash2, AlertTriangle, Lock, KeyRound, Loader2 } from "lucide-react"
import { useI18n } from "@/lib/i18n"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { NativeTestCenter } from "@/components/native-test-center"

export default function SettingsPage() {
  const { t } = useI18n()
  const { data: session } = useSession()
  const [pausing, setPausing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handlePause() {
    setPausing(true)
    try {
      const res = await fetch("/api/user/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pause" }),
      })
      if (res.ok) {
        toast.success(t("profile.accountPaused"))
        window.location.href = "/paused"
      } else {
        toast.error(t("profile.pauseError"))
      }
    } finally {
      setPausing(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await fetch("/api/user/account", { method: "DELETE" })
      if (res.ok) {
        toast.success(t("profile.accountDeleted"))
        await signOut({ redirect: false })
        window.location.replace("/")
      } else {
        toast.error(t("profile.deleteError"))
      }
    } finally {
      setDeleting(false)
    }
  }

  return (
    <PageContainer>
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon" className="shrink-0">
            <Link href="/profile">
              <ArrowLeft className="size-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-lg font-bold text-foreground">{t("settings.title")}</h1>
            <p className="text-xs text-muted-foreground">{t("settings.subtitle")}</p>
          </div>
        </div>

        {/* Kontoverwaltung */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <KeyRound className="size-4 text-primary" />
              {t("settings.accountManagement")}
            </CardTitle>
            <p className="text-xs text-muted-foreground">{t("settings.accountManagementDesc")}</p>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="w-full justify-start gap-2 text-sm text-muted-foreground">
                  <PauseCircle className="size-4" />
                  {t("profile.pauseAccount")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <PauseCircle className="size-5 text-yellow-500" />
                    {t("profile.pauseAccountConfirm")}
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-sm leading-relaxed">
                    {t("profile.pauseAccountDesc")}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handlePause}
                    disabled={pausing}
                    className="bg-yellow-500 hover:bg-yellow-600 text-white"
                  >
                    {pausing ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
                    {t("profile.pauseNow")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-2 text-sm text-muted-foreground/80 hover:text-destructive hover:bg-destructive/5"
                >
                  <Trash2 className="size-4" />
                  {t("profile.deleteAccount")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                    <AlertTriangle className="size-5" />
                    {t("profile.deleteAccountConfirm")}
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-sm leading-relaxed">
                    {t("profile.deleteAccountDesc")}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    disabled={deleting}
                    className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                  >
                    {deleting ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
                    {t("profile.deleteAccountConfirmBtn")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>

        {/* Native Features (nur in der App) */}
        <NativeTestCenter />

        {/* Passwortverwaltung */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Lock className="size-4 text-primary" />
              {t("settings.passwordManagement")}
            </CardTitle>
            <p className="text-xs text-muted-foreground">{t("settings.passwordManagementDesc")}</p>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button variant="outline" className="w-full justify-start gap-2" asChild>
              <Link href="/forgot-password">
                <KeyRound className="size-4" />
                {t("settings.requestPasswordReset")}
              </Link>
            </Button>
            <p className="text-[11px] text-muted-foreground">
              {t("settings.passwordResetHint")}
            </p>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  )
}
