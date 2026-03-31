"use client"

import { useState } from "react"
import Image from "next/image"
import { ChevronLeft, ChevronRight, User, ImageIcon } from "lucide-react"
import { useI18n } from "@/lib/i18n"

interface ShugyoInfoPanelProps {
  userName: string
  projects: { id: string; title: string; description: string; imageUrl: string }[]
}

export function ShugyoInfoPanel({ userName, projects }: ShugyoInfoPanelProps) {
  const { t } = useI18n()
  const [collapsed, setCollapsed] = useState(false)

  if (projects.length === 0) return null

  return (
    <div
      className={`absolute top-14 right-0 z-20 flex flex-col rounded-l-xl border border-r-0 border-[rgba(231,229,227,0.6)] bg-[rgba(255,255,255,0.95)] shadow-lg backdrop-blur-sm transition-all ${
        collapsed ? "w-10" : "w-64 max-h-[50vh]"
      }`}
    >
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -left-6 top-1/2 -translate-y-1/2 flex size-6 items-center justify-center rounded-l border border-r-0 border-[rgba(231,229,227,0.6)] bg-card shadow"
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

          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-2">
              {t("shugyo.projectImages")}
            </p>
              <div className="flex flex-col gap-2">
                {projects.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-lg border border-[rgba(231,229,227,0.4)] overflow-hidden bg-[rgba(245,245,244,0.3)]"
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
                      <div className="flex aspect-video items-center justify-center bg-[rgba(245,245,244,0.5)]">
                        <ImageIcon className="size-8 text-[rgba(120,113,108,0.4)]" />
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
        </div>
      )}
    </div>
  )
}
