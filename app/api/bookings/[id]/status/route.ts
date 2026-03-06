import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { sendBookingStatusEmail } from "@/lib/email"
import type { BookingStatus } from "@prisma/client"

export const runtime = "nodejs"

/**
 * GET — handle accept/decline links from the confirmation email.
 * ?action=confirmed|declined&token=xxx
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { searchParams } = new URL(req.url)
  const action = searchParams.get("action") as "confirmed" | "declined" | null
  const token = searchParams.get("token")

  if (!action || !["confirmed", "declined"].includes(action) || !token) {
    return new Response(htmlPage("Ungueltiger Link", "Der Link ist ungueltig oder abgelaufen."), {
      status: 400,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    })
  }

  try {
    const booking = await prisma.booking.findUnique({ where: { id } })

    if (!booking) {
      return new Response(htmlPage("Buchung nicht gefunden", "Diese Buchung existiert nicht mehr."), {
        status: 404,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      })
    }
    if (booking.statusToken !== token) {
      return new Response(htmlPage("Zugriff verweigert", "Der Sicherheitstoken ist ungueltig."), {
        status: 403,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      })
    }
    if (booking.status !== "pending") {
      return new Response(
        htmlPage("Bereits bearbeitet", `Diese Buchung wurde bereits als "${booking.status}" markiert.`),
        { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
      )
    }

    await prisma.booking.update({
      where: { id },
      data: { status: action as BookingStatus },
    })

    try {
      await sendBookingStatusEmail({
        to: booking.userEmail,
        userName: booking.userName,
        takumiName: booking.expertName,
        date: booking.date,
        startTime: booking.startTime,
        endTime: booking.endTime,
        status: action,
      })
    } catch { /* email failure should not revert the status */ }

    const msg =
      action === "confirmed"
        ? "Du hast die Buchung angenommen. Der Nutzer wurde per E-Mail benachrichtigt."
        : "Du hast die Buchung abgelehnt. Der Nutzer wurde per E-Mail benachrichtigt."

    return new Response(
      htmlPage(action === "confirmed" ? "Buchung bestaetigt" : "Buchung abgelehnt", msg),
      { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
    )
  } catch (err: unknown) {
    return new Response(htmlPage("Fehler", (err as Error).message), {
      status: 500,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    })
  }
}

/**
 * PATCH — programmatic status update from dashboard
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const { action, token } = await req.json()
    if (!action || !["confirmed", "declined"].includes(action) || !token) {
      return NextResponse.json({ error: "Ungueltige Anfrage." }, { status: 400 })
    }

    const booking = await prisma.booking.findUnique({ where: { id } })
    if (!booking || booking.statusToken !== token) {
      return NextResponse.json({ error: "Nicht gefunden oder ungueltig." }, { status: 404 })
    }
    if (booking.status !== "pending") {
      return NextResponse.json({ error: "Bereits bearbeitet." }, { status: 409 })
    }

    await prisma.booking.update({
      where: { id },
      data: { status: action as BookingStatus },
    })

    try {
      await sendBookingStatusEmail({
        to: booking.userEmail,
        userName: booking.userName,
        takumiName: booking.expertName,
        date: booking.date,
        startTime: booking.startTime,
        endTime: booking.endTime,
        status: action,
      })
    } catch { /* ignore */ }

    return NextResponse.json({ success: true, status: action })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

function htmlPage(title: string, message: string): string {
  return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>${title} - diAiway</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{min-height:100vh;display:flex;align-items:center;justify-content:center;background:#fafaf9;font-family:system-ui,-apple-system,sans-serif;padding:24px}
.card{max-width:420px;width:100%;background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,.06);overflow:hidden;text-align:center}
.hdr{background:linear-gradient(135deg,#064e3b,#065f46);padding:24px;color:#f0fdf4}
.hdr h1{font-size:14px;letter-spacing:1px;opacity:.7;margin-top:4px}
.logo{font-size:20px;font-weight:700}.logo span{color:#f59e0b}
.body{padding:32px 24px}.body h2{font-size:18px;color:#1c1917;margin-bottom:12px}.body p{font-size:14px;color:#78716c;line-height:1.6}</style></head>
<body><div class="card"><div class="hdr"><div class="logo">di<span>Ai</span>way</div><h1>MEISTERWISSEN DIGITAL</h1></div>
<div class="body"><h2>${title}</h2><p>${message}</p></div></div></body></html>`
}
