import Link from "next/link"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { ReviewStars } from "@/components/review-stars"
import { Video, Clock, Calendar } from "lucide-react"
import type { Session } from "@/lib/types"

const statusConfig = {
  active: { label: "Aktiv", className: "bg-accent/15 text-accent border-accent/30" },
  upcoming: { label: "Geplant", className: "bg-primary/10 text-primary border-primary/30" },
  completed: { label: "Abgeschlossen", className: "bg-muted text-muted-foreground border-border" },
  cancelled: { label: "Storniert", className: "bg-destructive/10 text-destructive border-destructive/30" },
}

export function SessionCard({ session }: { session: Session }) {
  const status = statusConfig[session.status]
  const date = new Date(session.scheduledAt)

  return (
    <Link href={`/sessions/${session.id}`}>
      <Card className="gap-0 overflow-hidden border-border/60 py-0 transition-shadow hover:shadow-md">
        <CardContent className="flex items-start gap-3 p-4">
          <Avatar className="size-12 shrink-0 border-2 border-primary/10">
            <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
              {session.takumi.avatar}
            </AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-semibold text-foreground">
                {session.takumi.name}
              </span>
              <Badge variant="outline" className={`shrink-0 text-[10px] ${status.className}`}>
                {status.label}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">{session.category}</p>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="size-3" />
                {date.toLocaleDateString("de-DE", { day: "2-digit", month: "short" })}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="size-3" />
                {date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
              </span>
              <span className="flex items-center gap-1">
                <Video className="size-3" />
                {session.duration} Min
              </span>
            </div>
            {session.status === "completed" && session.rating && (
              <div className="flex items-center gap-2 pt-0.5">
                <ReviewStars rating={session.rating} />
                {session.review && (
                  <span className="truncate text-[10px] text-muted-foreground italic">
                    &ldquo;{session.review}&rdquo;
                  </span>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
