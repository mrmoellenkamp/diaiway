"use client"

import { useSession, signOut } from "next-auth/react"
import Link from "next/link"
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
            <LogIn className="size-4 text-primary" />
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
            <LogIn className="mr-1.5 size-3.5" />
            {t("nav.login")}
          </Link>
        </Button>
      </div>
    )
  }

  const userName = session.user.name || t("common.profile")
  const userRole = (session.user as { role?: string }).role
  const appRole = (session.user as { appRole?: string }).appRole
  const initials = userName
    .split(" ")
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
              <img src={session.user.image} alt={userName} className="size-full rounded-full object-cover" />
            ) : (
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                {initials}
              </AvatarFallback>
            )}
          </Avatar>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-foreground">{userName}</span>
            <span className="text-[11px] text-muted-foreground">{session.user.email}</span>
          </div>
        </div>
        <Link
          href="/profile"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-muted"
        >
          <User className="size-4 text-muted-foreground" />
          {t("nav.myProfile")}
        </Link>
        {(appRole === "takumi" || userRole === "admin") && (
          <Link
            href="/dashboard/availability"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-muted"
          >
            <CalendarClock className="size-4 text-muted-foreground" />
            {t("nav.myAvailability")}
          </Link>
        )}
        {userRole === "admin" && (
          <Link
            href="/admin"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-muted"
          >
            <Settings className="size-4 text-muted-foreground" />
            {t("nav.expertAdmin")}
          </Link>
        )}
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-destructive transition-colors hover:bg-destructive/10"
        >
          <LogOut className="size-4" />
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
              <img src={session.user.image} alt={userName} className="size-full rounded-full object-cover" />
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
          <p className="text-sm font-semibold text-foreground">{userName}</p>
          <p className="text-xs text-muted-foreground">{session.user.email}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profile" className="flex items-center gap-2">
            <User className="size-4" />
            {t("nav.myProfile")}
          </Link>
        </DropdownMenuItem>
        {(appRole === "takumi" || userRole === "admin") && (
          <DropdownMenuItem asChild>
            <Link href="/dashboard/availability" className="flex items-center gap-2">
              <CalendarClock className="size-4" />
              {t("nav.myAvailability")}
            </Link>
          </DropdownMenuItem>
        )}
        {userRole === "admin" && (
          <DropdownMenuItem asChild>
            <Link href="/admin" className="flex items-center gap-2">
              <Settings className="size-4" />
              {t("nav.expertAdmin")}
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => signOut({ callbackUrl: "/" })}
          className="flex items-center gap-2 text-destructive focus:text-destructive"
        >
          <LogOut className="size-4" />
          {t("nav.logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
