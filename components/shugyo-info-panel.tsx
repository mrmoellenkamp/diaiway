"use client"

import { useState } from "react"
import Image from "next/image"
import { ChevronLeft, ChevronRight, User, ImageIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { useI18n } from "@/lib/i18n"

const SKILL_COLORS: Record<string, string> = {
  NEULING: "bg-emerald-500/20 text-emerald-700 dark:bg-emerald-500/30 dark:text-emerald-300 border-emerald-500/40",
  FORTGESCHRITTEN: "bg-blue-500/20 text-blue-700 dark:bg-blue-500/30 dark:text-blue-300 border-blue-500/40",
  PROFI: "bg-violet-500/20 text-violet-700 dark:bg-violet-500/30 dark:text-violet-300 border-violet-500/40",
}

interface ShugyoInfoPanelProps {
  userName: string
  skillLevel: string | null
  projects: { id: string; title: string; description: string; imageUrl: string }[]
}

export function ShugyoInfoPanel({ userName, skillLevel, projects }: ShugyoInfoPanelProps) {
  const { t } = useI18n()
  const [collapsed, setCollapsed] = useState(false)

  const skillLabel =
    skillLevel === "NEULING"
      ? t("shugyo.skillNeuling")
      : skillLevel === "FORTGESCHRITTEN"
        ? t("shugyo.skillFortgeschritten")
        : skillLevel === "PROFI"
          ? t("shugyo.skillProfi")
          : null

  if (!skillLabel && projects.length === 0) return null

  return (
    <div
      className={`absolute top-14 right-0 z-20 flex flex-col rounded-l-xl border border-r-0 border-border/60 bg-card/95 shadow-lg backdrop-blur-sm transition-all ${
        collapsed ? "w-10" : "w-64 max-h-[50vh]"
      }`}
    >
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -left-6 top-1/2 -translate-y-1/2 flex size-6 items-center justify-center rounded-l border border-r-0 border-border/60 bg-card shadow"
        aria-label={collapsed ? t("shugyo.expandPanel") : t("shugyo.collapsePanel")}
      >
        {collapsed ? (
          <ChevronLeft className="size-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-3.5 text-muted-foreground" />
        )}
      </button>

      {!collapsed && (
        <div className="flex flex-col gap-3 overflow-y-auto p-3">
          <div className="flex items-center gap-2">
            <User className="size-4 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium text-foreground truncate">{userName}</span>
          </div>

          {skillLabel && (
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
                {t("shugyo.skillLevel")}
              </p>
              <Badge
                variant="outline"
                className={`text-[10px] font-medium ${SKILL_COLORS[skillLevel!] ?? "bg-muted"}`}
              >
                {skillLabel}
              </Badge>
            </div>
          )}

          {projects.length > 0 && (
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-2">
                {t("shugyo.projectImages")}
              </p>
              <div className="flex flex-col gap-2">
                {projects.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-lg border border-border/40 overflow-hidden bg-muted/30"
                  >
                    {p.imageUrl ? (
                      <div className="relative aspect-video w-full">
                        <Image
                          src={p.imageUrl}
                          alt={p.title}
                          fill
                          className="object-cover"
                          sizes="200px"
                        />
                      </div>
                    ) : (
                      <div className="flex aspect-video items-center justify-center bg-muted/50">
                        <ImageIcon className="size-8 text-muted-foreground/40" />
                      </div>
                    )}
                    <div className="p-2">
                      <p className="text-xs font-medium text-foreground line-clamp-1">{p.title}</p>
                      {p.description && (
                        <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">
                          {p.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
