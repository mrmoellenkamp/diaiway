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
          ? "border border-[rgba(231,229,227,0.7)] bg-[rgba(255,255,255,0.95)] shadow-sm"
          : "border border-[rgba(255,255,255,0.2)] bg-[rgba(0,0,0,0.3)]",
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
                  : "text-[rgba(255,255,255,0.9)] hover:bg-[rgba(255,255,255,0.1)]",
            )}
          >
            {code}
          </Link>
        )
      })}
    </nav>
  )
}
