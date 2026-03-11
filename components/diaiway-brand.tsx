import { cn } from "@/lib/utils"

interface DiAiwayBrandProps {
  className?: string
}

/** "diAiway" mit Ai fett und grün (accent) */
export function DiAiwayBrand({ className }: DiAiwayBrandProps) {
  return (
    <span className={cn("inline", className)}>
      di<span className="font-bold text-accent">Ai</span>way
    </span>
  )
}
