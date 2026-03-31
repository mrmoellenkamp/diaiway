"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, MousePointerClick, Timer, Users, LogIn, Percent, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type AnalyticsPayload = {
  degraded?: boolean
  degradedReason?: string
  range: { days: number; since: string }
  summary: {
    totalSessions: number
    uniqueVisitors: number
    loggedInSessions: number
    anonymousSessions: number
    avgEngagedSeconds: number
    avgWallSeconds: number
    bounceRatePct: number
    singlePageSessions: number
  }
  byDay: { day: string; sessions: number; visitors: number }[]
  topPaths: { path: string; views: number; sessions: number }[]
}

function fmtSeconds(s: number) {
  if (!Number.isFinite(s) || s < 0) return "—"
  if (s < 60) return `${Math.round(s)} s`
  const m = Math.floor(s / 60)
  const sec = Math.round(s % 60)
  return `${m} min ${sec > 0 ? `${sec} s` : ""}`.trim()
}

export function AdminAnalyticsTab() {
  const [days, setDays] = useState(14)
  const [data, setData] = useState<AnalyticsPayload | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/analytics?days=${days}`)
      const json = (await res.json()) as AnalyticsPayload
      setData(json)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => {
    void load()
  }, [load])

  const maxBar = Math.max(1, ...(data?.byDay.map((d) => d.sessions) ?? [1]))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Zeitraum</span>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value={7}>7 Tage</option>
            <option value={14}>14 Tage</option>
            <option value={30}>30 Tage</option>
            <option value={90}>90 Tage</option>
          </select>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
          Aktualisieren
        </Button>
      </div>

      {data?.degraded && data.degradedReason && (
        <div className="rounded-xl border border-[rgba(245,158,11,0.4)] bg-[rgba(245,158,11,0.1)] px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
          <span className="font-semibold">Hinweis: </span>
          {data.degradedReason}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Erfasst werden anonyme Browser-Sitzungen (UUID im LocalStorage), Pfade und aktive Zeit bei sichtbarem Tab.
        Admin-Bereiche werden nicht getrackt. Keine IP-Speicherung in dieser Auswertung.
      </p>

      {loading && !data && (
        <div className="flex justify-center py-12">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Card className="border-[rgba(231,229,227,0.5)]">
              <CardContent className="p-4">
                <div className="flex size-9 items-center justify-center rounded-lg bg-[rgba(59,130,246,0.1)] text-blue-600">
                  <MousePointerClick className="size-4" />
                </div>
                <p className="mt-2 text-2xl font-bold text-foreground">{data.summary.totalSessions}</p>
                <p className="text-xs font-medium text-muted-foreground">Besuche (Sitzungen)</p>
              </CardContent>
            </Card>
            <Card className="border-[rgba(231,229,227,0.5)]">
              <CardContent className="p-4">
                <div className="flex size-9 items-center justify-center rounded-lg bg-[rgba(139,92,246,0.1)] text-violet-600">
                  <Users className="size-4" />
                </div>
                <p className="mt-2 text-2xl font-bold text-foreground">{data.summary.uniqueVisitors}</p>
                <p className="text-xs font-medium text-muted-foreground">Unique Besucher</p>
              </CardContent>
            </Card>
            <Card className="border-[rgba(231,229,227,0.5)]">
              <CardContent className="p-4">
                <div className="flex size-9 items-center justify-center rounded-lg bg-[rgba(20,184,166,0.1)] text-teal-600">
                  <Timer className="size-4" />
                </div>
                <p className="mt-2 text-xl font-bold text-foreground leading-tight">
                  {fmtSeconds(data.summary.avgEngagedSeconds)}
                </p>
                <p className="text-xs font-medium text-muted-foreground">Ø aktive Zeit / Besuch</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Tab sichtbar (Heartbeats)
                </p>
              </CardContent>
            </Card>
            <Card className="border-[rgba(231,229,227,0.5)]">
              <CardContent className="p-4">
                <div className="flex size-9 items-center justify-center rounded-lg bg-[rgba(249,115,22,0.1)] text-orange-600">
                  <Timer className="size-4" />
                </div>
                <p className="mt-2 text-xl font-bold text-foreground leading-tight">
                  {fmtSeconds(data.summary.avgWallSeconds)}
                </p>
                <p className="text-xs font-medium text-muted-foreground">Ø Sitzungslänge (Start → letzte Aktivität)</p>
              </CardContent>
            </Card>
            <Card className="border-[rgba(231,229,227,0.5)]">
              <CardContent className="p-4">
                <div className="flex size-9 items-center justify-center rounded-lg bg-[rgba(34,197,94,0.1)] text-green-600">
                  <LogIn className="size-4" />
                </div>
                <p className="mt-2 text-2xl font-bold text-foreground">{data.summary.loggedInSessions}</p>
                <p className="text-xs font-medium text-muted-foreground">Sitzungen mit Login</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {data.summary.totalSessions > 0
                    ? `${Math.round((data.summary.loggedInSessions / data.summary.totalSessions) * 100)} % aller Sitzungen`
                    : "—"}
                </p>
              </CardContent>
            </Card>
            <Card className="border-[rgba(231,229,227,0.5)]">
              <CardContent className="p-4">
                <div className="flex size-9 items-center justify-center rounded-lg bg-[rgba(245,158,11,0.1)] text-amber-600">
                  <Percent className="size-4" />
                </div>
                <p className="mt-2 text-2xl font-bold text-foreground">{data.summary.bounceRatePct} %</p>
                <p className="text-xs font-medium text-muted-foreground">„Bounce“ (nur 1 Seite)</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{data.summary.singlePageSessions} Sitzungen</p>
              </CardContent>
            </Card>
          </div>

          <Card className="border-[rgba(231,229,227,0.5)]">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold">Besuche pro Tag</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {data.byDay.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Noch keine Daten im Zeitraum.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {data.byDay.map((row) => (
                    <div key={row.day} className="flex items-center gap-2 text-xs">
                      <span className="w-24 shrink-0 font-mono text-muted-foreground">{row.day}</span>
                      <div className="h-6 min-w-0 flex-1 rounded-md bg-[rgba(245,245,244,0.6)] overflow-hidden">
                        <div
                          className="h-full rounded-md bg-[rgba(6,78,59,0.7)] transition-all"
                          style={{ width: `${Math.max(4, (row.sessions / maxBar) * 100)}%` }}
                          title={`${row.sessions} Sitzungen`}
                        />
                      </div>
                      <span className="w-16 shrink-0 text-right font-medium">{row.sessions}</span>
                      <span className="w-14 shrink-0 text-right text-muted-foreground">{row.visitors} UV</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-[rgba(231,229,227,0.5)]">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold">Beliebte Pfade</CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-2">
              {data.topPaths.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center px-4">Keine Seitenaufrufe erfasst.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Pfad</TableHead>
                      <TableHead className="text-xs text-right w-20">Aufrufe</TableHead>
                      <TableHead className="text-xs text-right w-24">Sitzungen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.topPaths.map((r) => (
                      <TableRow key={r.path}>
                        <TableCell className="font-mono text-xs max-w-[200px] truncate" title={r.path}>
                          {r.path}
                        </TableCell>
                        <TableCell className="text-right text-xs">{r.views}</TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">{r.sessions}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
