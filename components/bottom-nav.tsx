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
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-md pointer-events-auto"
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="mx-auto flex max-w-lg items-center justify-around py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-1.5 text-xs transition-colors",
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
    </nav>
  )
}
