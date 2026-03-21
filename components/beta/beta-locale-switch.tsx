"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const LOCALES = [
  { href: "/beta/de", code: "DE" },
  { href: "/beta/en", code: "EN" },
  { href: "/beta/es", code: "ES" },
] as const

export function BetaLocaleSwitch({
  className,
  variant = "dark",
}: {
  className?: string
  /** dark: für dunkle Hero-Flächen | light: weißer Hintergrund */
  variant?: "dark" | "light"
}) {
  const pathname = usePathname()
  const isLight = variant === "light"
  return (
    <nav
      aria-label="Sprache"
      className={cn(
        "flex items-center gap-1 rounded-full px-1 py-0.5 backdrop-blur-sm",
        isLight
          ? "border border-border/70 bg-white/95 shadow-sm"
          : "border border-white/20 bg-black/30",
        className,
      )}
    >
      {LOCALES.map(({ href, code }) => {
        const active = pathname === href
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors",
              isLight
                ? active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted"
                : active
                  ? "bg-white text-primary"
                  : "text-white/90 hover:bg-white/10",
            )}
          >
            {code}
          </Link>
        )
      })}
    </nav>
  )
}
