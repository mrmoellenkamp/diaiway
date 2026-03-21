import { cn } from "@/lib/utils"

interface DiAiwayBrandProps {
  className?: string
  /** „di“/„way“ in hellem Text (z. B. dunkelgrüner Header); „Ai“ bleibt accent */
  lightOnDark?: boolean
}

/** "diAiway" mit Ai fett und grün (accent) */
export function DiAiwayBrand({ className, lightOnDark }: DiAiwayBrandProps) {
  return (
    <span className={cn("inline", className)}>
      <span className={cn(lightOnDark && "text-primary-foreground")}>di</span>
      <span className="font-bold text-accent">Ai</span>
      <span className={cn(lightOnDark && "text-primary-foreground")}>way</span>
    </span>
  )
}
