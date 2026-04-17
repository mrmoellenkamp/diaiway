"use client"

import { useState } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { hardSignOut } from "@/lib/hard-sign-out-client"
import { PageContainer } from "@/components/page-container"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { PauseCircle, Trash2, AlertTriangle, Lock, KeyRound, Loader2, Download, BellOff } from "lucide-react"
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
import { AppSubpageHeader } from "@/components/app-subpage-header"

export default function SettingsPage() {
  const { t } = useI18n()
  const { data: session } = useSession()
  const user = session?.user as { marketingOptIn?: boolean } | undefined
  const [pausing, setPausing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [unsubscribing, setUnsubscribing] = useState(false)
  const [marketingOptIn, setMarketingOptIn] = useState(user?.marketingOptIn ?? false)

  async function handleUnsubscribeMarketing() {
    setUnsubscribing(true)
    try {
      const res = await fetch("/api/user/marketing", { method: "DELETE" })
      if (res.ok) {
        setMarketingOptIn(false)
        toast.success(t("profile.unsubscribeSuccess"))
      } else {
        toast.error(t("profile.unsubscribeError"))
      }
    } catch {
      toast.error(t("profile.unsubscribeError"))
    } finally {
      setUnsubscribing(false)
    }
  }

  async function handleExport() {
    setExporting(true)
    try {
      const res = await fetch("/api/user/export")
      if (!res.ok) {
        toast.error(t("profile.exportError"))
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `diaiway-datenexport-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success(t("profile.exportSuccess"))
    } catch {
      toast.error(t("profile.exportError"))
    } finally {
      setExporting(false)
    }
  }

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
        await hardSignOut("/")
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
        <AppSubpageHeader title={t("settings.title")} subtitle={t("settings.subtitle")} />

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
            <Button
              variant="outline"
              className="w-full justify-start gap-2 text-sm text-muted-foreground"
              onClick={() => void handleExport()}
              disabled={exporting}
            >
              {exporting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              {t("profile.exportData")}
            </Button>

            {marketingOptIn && (
              <Button
                variant="outline"
                className="w-full justify-start gap-2 text-sm text-muted-foreground"
                onClick={() => void handleUnsubscribeMarketing()}
                disabled={unsubscribing}
              >
                {unsubscribing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <BellOff className="size-4" />
                )}
                {t("profile.unsubscribeMarketing")}
              </Button>
            )}

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
                  className="w-full justify-start gap-2 text-sm text-[rgba(120,113,108,0.8)] hover:text-destructive hover:bg-[rgba(239,68,68,0.05)]"
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
                    className="bg-destructive hover:bg-[rgba(239,68,68,0.9)] text-destructive-foreground"
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
