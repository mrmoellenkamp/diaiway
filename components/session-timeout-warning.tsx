"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useSessionActivity } from "./session-activity-provider"
import { useI18n } from "@/lib/i18n"
import { RefreshCw } from "lucide-react"

export function SessionTimeoutWarning() {
  const { showWarning, secondsLeft, resetActivity } = useSessionActivity()
  const { t } = useI18n()

  if (!showWarning) return null

  const mins = Math.floor(secondsLeft / 60)
  const secs = secondsLeft % 60
  const timeStr = `${mins}:${secs.toString().padStart(2, "0")}`

  return (
    <Dialog open={showWarning}>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-lg">
            {t("sessionTimeout.title")}
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {t("sessionTimeout.desc")} {timeStr}
        </p>
        <DialogFooter>
          <Button
            onClick={resetActivity}
            className="gap-2"
          >
            <RefreshCw className="size-4" />
            {t("sessionTimeout.extend")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
