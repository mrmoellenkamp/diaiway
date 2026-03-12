"use client"

import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PageContainer } from "@/components/page-container"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { LiveBadge } from "@/components/live-badge"
import { Badge } from "@/components/ui/badge"
import {
  CalendarClock,
  Radio,
  FolderOpen,
  Wallet,
  Inbox,
  TrendingUp,
  Calendar,
  User,
  ChevronRight,
  MessageSquare,
} from "lucide-react"
import { useI18n } from "@/lib/i18n"
import type { DashboardData, FavoriteOnline } from "@/lib/dashboard-data"

function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-")
  return `${d}.${m}.${y}`
}

function formatEuros(cents: number) {
  return (cents / 100).toFixed(2) + " €"
}

export function DashboardClient({ data }: { data: DashboardData }) {
  const { t } = useI18n()
  const isShugyo = data.appRole === "shugyo"

  return (
    <PageContainer noPadding>
      <div className="flex flex-col gap-5 px-4 py-4 pb-40">
        {/* Greeting */}
        <div>
          <p className="text-sm text-muted-foreground">{t("dashboard.greeting")}</p>
          <h1 className="text-xl font-bold text-foreground">{data.userName}</h1>
        </div>

        {isShugyo ? (
          /* ── Shugyo: Nächste Sessions, Live-Radar, Projekt-Status, Wallet ── */
          <>
            <DashboardCard
              title={t("dashboard.nextSessions")}
              href="/sessions"
              linkLabel={t("dashboard.viewSessions")}
              icon={<CalendarClock className="size-5" />}
            >
              {data.nextSessions.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">{t("dashboard.noNextSessions")}</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {data.nextSessions.slice(0, 3).map((b) => (
                    <Link
                      key={b.id}
                      href={`/session/${b.id}`}
                      className="flex items-center gap-3 rounded-lg p-3 -mx-1 hover:bg-muted/50 active:bg-muted transition-colors touch-manipulation"
                    >
                      <Avatar className="size-10 shrink-0">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                          {(b.takumiAvatar ?? b.expertName?.slice(0, 2) ?? "?").toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{b.expertName}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(b.date)} · {b.startTime}
                        </p>
                      </div>
                      <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                    </Link>
                  ))}
                </div>
              )}
            </DashboardCard>

            <DashboardCard
              title={t("dashboard.liveRadar")}
              icon={<Radio className="size-5" />}
            >
              {data.favoritesOnline.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">{t("dashboard.noFavoritesOnline")}</p>
              ) : (
                <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 scrollbar-none touch-pan-x">
                  {data.favoritesOnline.map((fav) => (
                    <FavoriteOnlineCard key={fav.id} fav={fav} />
                  ))}
                </div>
              )}
            </DashboardCard>

            <DashboardCard
              title={t("dashboard.projectStatus")}
              href="/ai-guide"
              linkLabel={t("dashboard.openAiGuide")}
              icon={<FolderOpen className="size-5" />}
            >
              <p className="text-sm text-muted-foreground">
                {t("shugyo.projectCount").replace("{count}", String(data.projectCount))}
              </p>
            </DashboardCard>

            <DashboardCard
              title={t("dashboard.wallet")}
              href="/profile/finances"
              linkLabel={t("dashboard.openWallet")}
              icon={<Wallet className="size-5" />}
            >
              <p className="text-lg font-semibold text-primary">
                {formatEuros(data.wallet?.balance ?? 0)}
              </p>
              <p className="text-xs text-muted-foreground">{t("dashboard.walletBalance")}</p>
            </DashboardCard>

            {data.threads.length > 0 && (
              <DashboardCard
                title={t("common.chats")}
                href="/messages"
                linkLabel={t("messages.title")}
                icon={<MessageSquare className="size-5" />}
                badge={data.threads.reduce((s, t) => s + t.unread, 0) || undefined}
              >
                <div className="flex flex-col gap-2">
                  {data.threads.slice(0, 2).map((th) => (
                    <Link
                      key={th.partnerId}
                      href={`/messages?with=${th.partnerId}`}
                      className="flex items-center gap-3 rounded-lg p-2 -mx-1 hover:bg-muted/50 active:bg-muted transition-colors touch-manipulation"
                    >
                      <Avatar className="size-9 shrink-0">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                          {th.partnerAvatar}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate flex items-center gap-1">
                          {th.partnerName}
                          {th.unread > 0 && (
                            <span className="size-2 rounded-full bg-accent shrink-0" />
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {th.lastMessage?.text ?? "—"}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </DashboardCard>
            )}
          </>
        ) : (
          /* ── Takumi: Buchungsanfragen, Einnahmen, Verfügbarkeit, Profil-Status ── */
          <>
            <DashboardCard
              title={t("dashboard.pendingBookings")}
              href="/dashboard/availability"
              linkLabel={t("dashboard.viewPending")}
              icon={<Inbox className="size-5" />}
              badge={data.pendingBookings.length > 0 ? data.pendingBookings.length : undefined}
            >
              {data.pendingBookings.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">
                  {t("dashboard.pendingCount").replace("{count}", "0")}
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  {data.pendingBookings.slice(0, 3).map((b) => (
                    <Link
                      key={b.id}
                      href={`/booking/respond/${b.id}`}
                      className="flex items-center gap-3 rounded-lg p-3 -mx-1 hover:bg-muted/50 active:bg-muted transition-colors touch-manipulation"
                    >
                      <Avatar className="size-10 shrink-0">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                          {(b.userName?.slice(0, 2) ?? "?").toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{b.userName}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(b.date)} · {b.startTime}
                        </p>
                      </div>
                      <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                    </Link>
                  ))}
                </div>
              )}
            </DashboardCard>

            <DashboardCard
              title={t("dashboard.earningsOverview")}
              href="/profile/finances"
              linkLabel={t("profile.finances")}
              icon={<TrendingUp className="size-5" />}
            >
              <p className="text-lg font-semibold text-primary">
                {formatEuros(data.earningsCents)}
              </p>
              <p className="text-xs text-muted-foreground">{t("dashboard.earningsTotal")}</p>
            </DashboardCard>

            <DashboardCard
              title={t("dashboard.availabilityCalendar")}
              href="/dashboard/availability"
              linkLabel={t("dashboard.openAvailability")}
              icon={<Calendar className="size-5" />}
            >
              <p className="text-sm text-muted-foreground">
                {t("nav.myAvailability")}
              </p>
            </DashboardCard>

            <DashboardCard
              title={t("dashboard.profileStatus")}
              href="/profile"
              linkLabel={t("dashboard.openProfile")}
              icon={<User className="size-5" />}
            >
              <p className="text-sm text-muted-foreground">{t("nav.myProfile")}</p>
            </DashboardCard>

            {data.threads.length > 0 && (
              <DashboardCard
                title={t("common.chats")}
                href="/messages"
                linkLabel={t("messages.title")}
                icon={<MessageSquare className="size-5" />}
                badge={data.threads.reduce((s, t) => s + t.unread, 0) || undefined}
              >
                <div className="flex flex-col gap-2">
                  {data.threads.slice(0, 2).map((th) => (
                    <Link
                      key={th.partnerId}
                      href={`/messages?with=${th.partnerId}`}
                      className="flex items-center gap-3 rounded-lg p-2 -mx-1 hover:bg-muted/50 active:bg-muted transition-colors touch-manipulation"
                    >
                      <Avatar className="size-9 shrink-0">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                          {th.partnerAvatar}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate flex items-center gap-1">
                          {th.partnerName}
                          {th.unread > 0 && (
                            <span className="size-2 rounded-full bg-accent shrink-0" />
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {th.lastMessage?.text ?? "—"}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </DashboardCard>
            )}
          </>
        )}
      </div>
    </PageContainer>
  )
}

function DashboardCard({
  title,
  children,
  href,
  linkLabel,
  icon,
  badge,
}: {
  title: string
  children: React.ReactNode
  href?: string
  linkLabel?: string
  icon: React.ReactNode
  badge?: number
}) {
  return (
    <Card className="overflow-hidden border-border/60 touch-manipulation">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-primary">{icon}</span>
          <CardTitle className="text-base">{title}</CardTitle>
          {badge != null && badge > 0 && (
            <Badge variant="secondary" className="text-xs">
              {badge}
            </Badge>
          )}
        </div>
        {href && linkLabel && (
          <Link
            href={href}
            className="text-xs font-medium text-primary hover:underline flex items-center gap-0.5"
          >
            {linkLabel}
            <ChevronRight className="size-3" />
          </Link>
        )}
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  )
}

function FavoriteOnlineCard({ fav }: { fav: FavoriteOnline }) {
  return (
    <Link
      href={`/takumi/${fav.id}`}
      className="flex w-28 shrink-0 flex-col items-center gap-2 rounded-xl border border-border/60 bg-card p-3 transition-shadow hover:shadow-md active:scale-[0.98]"
    >
      <div className="relative">
        <Avatar className="size-14 border-2 border-primary/10">
          <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">
            {fav.avatar}
          </AvatarFallback>
        </Avatar>
        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2">
          <LiveBadge />
        </span>
      </div>
      <div className="flex flex-col items-center gap-0.5 text-center w-full min-w-0">
        <span className="text-xs font-semibold text-foreground truncate w-full">
          {fav.name}
        </span>
        <span className="text-[10px] text-muted-foreground truncate w-full">
          {fav.subcategory}
        </span>
      </div>
    </Link>
  )
}
