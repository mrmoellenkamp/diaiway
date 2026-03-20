"use client"

import { useSession, signOut } from "next-auth/react"
import Link from "next/link"
import Image from "next/image"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { User, Settings, LogOut, LogIn, ChevronDown, CalendarClock } from "lucide-react"
import { VerifiedBadge } from "@/components/verified-badge"
import { useI18n } from "@/lib/i18n"
import { cn } from "@/lib/utils"

export function UserNav({ variant = "default" }: { variant?: "default" | "landing" | "mobile" }) {
  const { data: session, status } = useSession()
  const { t } = useI18n()
  const isLoading = status === "loading"
  const isLoggedIn = status === "authenticated" && session?.user

  if (isLoading) {
    return <div className="size-8 animate-pulse rounded-full bg-muted" />
  }

  if (!isLoggedIn) {
    if (variant === "mobile") {
      return (
        <div className="flex flex-col gap-2 pt-2 border-t border-border/40">
          <Link
            href="/login"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            <LogIn className="size-4 text-primary icon-paper" />
            {t("nav.login")}
          </Link>
          <Link
            href="/register"
            className="flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t("nav.register")}
          </Link>
        </div>
      )
    }

    return (
      <div className="flex items-center gap-2">
        <Button
          asChild
          variant="outline"
          size="sm"
          className={
            variant === "landing"
              ? "h-9 rounded-lg border-primary-foreground/25 bg-transparent text-sm font-medium text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
              : "h-9 rounded-lg border-primary/30 text-sm font-medium text-primary hover:bg-primary/5"
          }
        >
          <Link href="/login">
            <LogIn className="mr-1.5 size-3.5 icon-paper" />
            {t("nav.login")}
          </Link>
        </Button>
      </div>
    )
  }

  const userName = (session.user as { username?: string | null }).username ?? session.user.name ?? t("common.profile")
  const userRole = (session.user as { role?: string }).role
  const appRole = (session.user as { appRole?: string }).appRole
  const isVerified = (session.user as { isVerified?: boolean }).isVerified ?? false
  const initials = userName
    .replace(/[^a-zA-Z0-9]/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  if (variant === "mobile") {
    return (
      <div className="flex flex-col gap-1 pt-2 border-t border-border/40">
        <div className="flex items-center gap-3 px-3 py-2">
          <Avatar className="size-9 border-2 border-primary/10">
            {session.user.image ? (
              <Image
                src={session.user.image}
                alt={userName}
                width={36}
                height={36}
                unoptimized
                className="size-full rounded-full object-cover"
              />
            ) : (
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                {initials}
              </AvatarFallback>
            )}
          </Avatar>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold text-foreground">{userName}</span>
              {isVerified && <VerifiedBadge size="sm" />}
            </div>
            <span className="text-[11px] text-muted-foreground">{session.user.email}</span>
          </div>
        </div>
        <Link
          href="/profile"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-muted"
        >
          <User className="size-4 text-muted-foreground icon-paper" />
          {t("nav.myProfile")}
        </Link>
        {(appRole === "takumi" || userRole === "admin") && (
          <Link
            href="/profile/availability"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-muted"
          >
            <CalendarClock className="size-4 text-muted-foreground icon-paper" />
            {t("nav.myAvailability")}
          </Link>
        )}
        {userRole === "admin" && (
          <Link
            href="/admin"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-muted"
          >
            <Settings className="size-4 text-muted-foreground icon-paper" />
            {t("profile.adminDashboard")}
          </Link>
        )}
        <button
          onClick={async () => {
            await signOut({ redirect: false })
            window.location.replace("/")
          }}
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-destructive transition-colors hover:bg-destructive/10"
        >
          <LogOut className="size-4 icon-paper" />
          {t("nav.logout")}
        </button>
      </div>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full py-1 pl-1 pr-2.5 transition-colors hover:bg-muted/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95 sm:min-w-0">
          <Avatar className="size-8 border-2 border-primary/10">
            {session.user.image ? (
              <Image
                src={session.user.image}
                alt={userName}
                width={32}
                height={32}
                unoptimized
                className="size-full rounded-full object-cover"
              />
            ) : (
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                {initials}
              </AvatarFallback>
            )}
          </Avatar>
          <span className={cn("hidden text-sm font-medium sm:inline", variant === "landing" ? "text-white" : "text-foreground")}>
            {userName.split(" ")[0]}
          </span>
          <ChevronDown className={cn("size-3.5", variant === "landing" ? "text-white/80" : "text-muted-foreground")} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <div className="px-3 py-2">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold text-foreground">{userName}</p>
            {isVerified && <VerifiedBadge size="sm" />}
          </div>
          <p className="text-xs text-muted-foreground">{session.user.email}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profile" className="flex items-center gap-2">
            <User className="size-4 icon-paper" />
            {t("nav.myProfile")}
          </Link>
        </DropdownMenuItem>
        {(appRole === "takumi" || userRole === "admin") && (
          <DropdownMenuItem asChild>
            <Link href="/profile/availability" className="flex items-center gap-2">
              <CalendarClock className="size-4 icon-paper" />
              {t("nav.myAvailability")}
            </Link>
          </DropdownMenuItem>
        )}
        {userRole === "admin" && (
          <DropdownMenuItem asChild>
            <Link href="/admin" className="flex items-center gap-2">
              <Settings className="size-4 icon-paper" />
            {t("profile.adminDashboard")}
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={async () => {
            await signOut({ redirect: false })
            window.location.replace("/")
          }}
          className="flex items-center gap-2 text-destructive focus:text-destructive"
        >
          <LogOut className="size-4 icon-paper" />
          {t("nav.logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
