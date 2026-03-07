"use client"

import { cn } from "@/lib/utils"
import { useI18n } from "@/lib/i18n"

interface RoleSelectorProps {
  selected: "shugyo" | "takumi" | null
  onSelect: (role: "shugyo" | "takumi") => void
}

export function RoleSelector({ selected, onSelect }: RoleSelectorProps) {
  const { t } = useI18n()

  return (
    <div className="grid grid-cols-2 gap-3">
      <button
        type="button"
        onClick={() => onSelect("shugyo")}
        className={cn(
          "group flex flex-col items-center gap-3 rounded-xl border-2 p-5 text-center transition-all",
          selected === "shugyo"
            ? "border-primary bg-primary/5 shadow-md"
            : "border-border hover:border-primary/30"
        )}
      >
        <span className="font-jp text-3xl transition-transform group-hover:scale-110">修行</span>
        <div className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-foreground">Shugyo</span>
          <span className="text-xs text-muted-foreground">{t("register.shugyoSubtitle")}</span>
        </div>
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          {t("register.shugyoDesc")}
        </p>
      </button>

      <button
        type="button"
        onClick={() => onSelect("takumi")}
        className={cn(
          "group flex flex-col items-center gap-3 rounded-xl border-2 p-5 text-center transition-all",
          selected === "takumi"
            ? "border-accent bg-accent/5 shadow-md"
            : "border-border hover:border-accent/30"
        )}
      >
        <span className="font-jp text-3xl transition-transform group-hover:scale-110">匠</span>
        <div className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-foreground">Takumi</span>
          <span className="text-xs text-muted-foreground">{t("register.takumiSubtitle")}</span>
        </div>
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          {t("register.takumiDesc")}
        </p>
      </button>
    </div>
  )
}
