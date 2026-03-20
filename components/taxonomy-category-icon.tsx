"use client"

import * as LucideIcons from "lucide-react"
import { cn } from "@/lib/utils"

type IconProps = { className?: string; style?: React.CSSProperties; size?: number }

export function TaxonomyCategoryIcon({
  iconKey,
  iconImageUrl,
  color,
  className,
  size = 24,
}: {
  iconKey: string
  iconImageUrl?: string | null
  color?: string
  className?: string
  size?: number
}) {
  if (iconImageUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={iconImageUrl}
        alt=""
        width={size}
        height={size}
        className={cn("object-contain", className)}
      />
    )
  }
  const map = LucideIcons as unknown as Record<string, React.ComponentType<IconProps>>
  const Icon = map[iconKey] ?? LucideIcons.Briefcase
  return <Icon className={className} style={{ color, width: size, height: size }} size={size} />
}
