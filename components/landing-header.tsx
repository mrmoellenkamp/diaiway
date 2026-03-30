"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { useSession, signOut } from "next-auth/react"
import { Menu, X, User, Mail, FolderOpen, LogOut } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { UserNav } from "@/components/user-nav"
import { LanguageSwitcher } from "@/components/language-switcher"
import { useI18n } from "@/lib/i18n"
import { communicationUsername } from "@/lib/communication-display"
import { useApp } from "@/lib/app-context"

export function LandingHeader() {
  const { userAvatar } = useApp()
  const { data: session } = useSession()
  const isLoggedIn = !!session?.user
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { t } = useI18n()

  const userName = session?.user
    ? communicationUsername((session.user as { username?: string | null }).username, t("common.profile"))
    : ""
  const initials = userName
    .replace(/[^a-zA-Z0-9]/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  const mobileAvatarSrc = (userAvatar || session?.user?.image || "").trim()

  return (
    <header className="sticky top-0 z-50 border-b border-primary-foreground/10 bg-primary/95 backdrop-blur-md pointer-events-auto pt-[env(safe-area-inset-top,0px)]">
        <div className="mx-auto flex w-full max-w-lg min-w-0 items-center justify-between py-2.5 pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))]">
        <Link href="/" className="flex min-h-11 items-center gap-2 rounded-lg py-1 touch-manipulation">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-foreground/10">
            <span className="text-sm font-bold text-accent">di</span>
          </div>
          <span className="text-base font-bold text-primary-foreground">
            di<span className="text-accent">Ai</span>way
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <LanguageSwitcher variant="landing" />
          <div className="hidden sm:block">
            <UserNav variant="landing" />
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-primary-foreground transition-colors hover:bg-primary-foreground/10 touch-manipulation sm:hidden"
            aria-label="Menu"
          >
            {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="border-t border-primary-foreground/10 bg-card px-4 py-3 sm:hidden">
          {isLoggedIn ? (
            <nav className="flex flex-col gap-0.5">
              <div className="flex items-center gap-3 px-3 py-2.5">
                <Avatar className="size-10 border-2 border-primary/10">
                  {mobileAvatarSrc ? (
                    <Image
                      src={mobileAvatarSrc}
                      alt={userName}
                      width={40}
                      height={40}
                      unoptimized
                      className="size-full rounded-full object-cover"
                    />
                  ) : (
                    <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">
                      {initials}
                    </AvatarFallback>
                  )}
                </Avatar>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-foreground">{userName}</span>
                  {session?.user?.email && (
                    <span className="text-[11px] text-muted-foreground">{session.user.email}</span>
                  )}
                </div>
              </div>
              <Link
                href="/profile"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                <User className="size-4 text-muted-foreground" />
                {t("common.profile")}
              </Link>
              <Link
                href="/messages"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                <Mail className="size-4 text-muted-foreground" />
                {t("messages.title")}
              </Link>
              <Link
                href="/categories"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                <FolderOpen className="size-4 text-muted-foreground" />
                {t("common.categories")}
              </Link>
              <Link
                href="/home"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                <span className="size-4 flex items-center justify-center text-muted-foreground font-bold text-xs">di</span>
                {t("nav.menuDiAiway")}
              </Link>
              <button
                onClick={async () => {
                  setMobileMenuOpen(false)
                  await signOut({ redirect: false })
                  window.location.replace("/")
                }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
              >
                <LogOut className="size-4" />
                {t("nav.logout")}
              </button>
            </nav>
          ) : (
            <div onClick={() => setMobileMenuOpen(false)}>
              <UserNav variant="mobile" />
            </div>
          )}
        </div>
      )}
    </header>
  )
}

