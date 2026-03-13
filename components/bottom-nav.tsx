"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion } from "framer-motion"
import { Home, MessageSquare, User, LayoutGrid, Mail } from "lucide-react"
import { cn } from "@/lib/utils"
import { useI18n } from "@/lib/i18n"
import { DiAiwayBrand } from "@/components/diaiway-brand"
import { hapticLight } from "@/lib/native-utils"

export function BottomNav() {
  const pathname = usePathname()
  const { t } = useI18n()

  const navItems: { href: string; label: string; icon: typeof Home | null; brand?: boolean }[] = [
    { href: "/home", label: t("common.home"), icon: Home },
    { href: "/categories", label: t("common.categories"), icon: LayoutGrid },
    { href: "/ai-guide", label: "diAiway", icon: MessageSquare, brand: true },
    { href: "/messages", label: t("messages.title"), icon: Mail },
    { href: "/profile", label: t("common.profile"), icon: User },
  ]

  function handleNavClick(e: React.MouseEvent, href: string) {
    if (!pathname.startsWith(href)) hapticLight()
  }

  return (
    <footer
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 pointer-events-auto",
        "border-t border-border/80",
        "bg-card/90 backdrop-blur-xl",
        "shadow-[0_-4px_24px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_24px_rgba(0,0,0,0.2)]",
        "rounded-t-2xl"
      )}
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" } as React.CSSProperties}
      role="contentinfo"
      aria-label="Hauptnavigation"
    >
      <nav
        className="mx-auto max-w-lg"
        role="navigation"
        aria-label="Hauptnavigation"
      >
        <div className="flex items-center justify-around pt-3">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href)
            const isBrand = item.brand === true
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={(e) => handleNavClick(e, item.href)}
                className={cn(
                  "relative flex min-h-[48px] min-w-[48px] flex-col items-center justify-center gap-0.5 px-4 py-2.5 text-xs transition-colors active:scale-95 touch-manipulation",
                  isActive
                    ? "text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground"
                )}
                aria-current={isActive ? "page" : undefined}
              >
                {item.icon ? (
                  <item.icon
                    className={cn(
                      "size-5 transition-all icon-paper",
                      isActive && "scale-110 icon-paper-active"
                    )}
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                ) : null}
                {isBrand ? <DiAiwayBrand className="text-xs" /> : <span>{item.label}</span>}
                {isActive && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute -top-px left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-primary pointer-events-none"
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
              </Link>
            )
          })}
        </div>
      </nav>
    </footer>
  )
}
