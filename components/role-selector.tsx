"use client"

import { cn } from "@/lib/utils"

interface RoleSelectorProps {
  selected: "shugyo" | "takumi" | null
  onSelect: (role: "shugyo" | "takumi") => void
}

export function RoleSelector({ selected, onSelect }: RoleSelectorProps) {
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
          <span className="text-xs text-muted-foreground">Lerner & Suchender</span>
        </div>
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Finde Experten fur deine Fragen und Probleme
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
          <span className="text-xs text-muted-foreground">Meister & Experte</span>
        </div>
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Teile dein Wissen und verdiene Geld
        </p>
      </button>
    </div>
  )
}
