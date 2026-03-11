"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, MessageSquare, User, Mail, LayoutGrid } from "lucide-react"
import { cn } from "@/lib/utils"
import { useI18n } from "@/lib/i18n"

export function BottomNav() {
  const pathname = usePathname()
  const { t } = useI18n()

  const navItems = [
    { href: "/home", label: t("common.home"), icon: Home },
    { href: "/categories", label: t("common.categories"), icon: LayoutGrid },
    { href: "/ai-guide", label: t("common.aiGuide"), icon: MessageSquare },
    { href: "/messages", label: t("common.chats"), icon: Mail },
    { href: "/profile", label: t("common.profile"), icon: User },
  ]

  return (
    <footer
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 pointer-events-auto",
        "border-t border-border/80",
        "bg-card/90 backdrop-blur-xl",
        "shadow-[0_-4px_24px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_24px_rgba(0,0,0,0.2)]",
        "rounded-t-2xl"
      )}
      role="contentinfo"
      aria-label="Footer mit Navigation und rechtlichen Links"
    >
      <nav
        className="mx-auto max-w-lg"
        role="navigation"
        aria-label="Hauptnavigation"
      >
        <div
          className="flex items-center justify-around pt-3"
          style={{ paddingBottom: "0.25rem" } as React.CSSProperties}
        >
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex min-h-[48px] min-w-[48px] flex-col items-center justify-center gap-0.5 px-4 py-2.5 text-xs transition-colors active:scale-95 touch-manipulation",
                  isActive
                    ? "text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground"
                )}
                aria-current={isActive ? "page" : undefined}
              >
                <item.icon
                  className={cn(
                    "size-5 transition-all",
                    isActive && "scale-110"
                  )}
                  strokeWidth={isActive ? 2.5 : 2}
                />
                <span>{item.label}</span>
                {isActive && (
                  <span className="absolute -top-px left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-primary pointer-events-none" />
                )}
              </Link>
            )
          })}
        </div>
        {/* Rechtliche Links unterhalb der Icons */}
        <div
          className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 pb-3 text-[11px] text-muted-foreground/70"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" } as React.CSSProperties}
        >
          <Link
            href="/legal/datenschutz"
            className="transition-colors hover:text-muted-foreground"
          >
            {t("footer.privacy")}
          </Link>
          <span aria-hidden className="text-muted-foreground/50">·</span>
          <Link
            href="/help"
            className="transition-colors hover:text-muted-foreground"
          >
            {t("footer.helpSupport")}
          </Link>
          <span aria-hidden className="text-muted-foreground/50">·</span>
          <Link
            href="/legal/impressum"
            className="transition-colors hover:text-muted-foreground"
          >
            {t("footer.imprint")}
          </Link>
        </div>
      </nav>
    </footer>
  )
}
