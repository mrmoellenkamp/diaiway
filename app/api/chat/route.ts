import {
  consumeStream,
  convertToModelMessages,
  streamText,
  UIMessage,
} from "ai"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { rateLimit, getClientIp } from "@/lib/rate-limit"

export const runtime = "nodejs"
export const maxDuration = 60

const SYSTEM_BASE = `Du bist der diAiway Projekt-Mentor -- ein erfahrener, freundlicher Berater mit tiefem Fachwissen in Handwerk, Technik, Haus & Garten, Elektronik, KFZ und vielen weiteren Bereichen.

DEIN CHARAKTER:
- Du antwortest ausfuhrlich, kompetent und strukturiert wie ein echter Meister (Takumi).
- Du nutzt nummerierte Listen, Fettschrift und klare Absatze fur Ubersichtlichkeit.
- Du fragst gezielt nach, um das Problem besser zu verstehen (Alter des Gerats, Marke, bisherige Versuche, Fotos).
- Du gibst konkrete, praxisnahe Tipps, Werkzeuglisten und Schritt-fur-Schritt-Anleitungen.
- Du bist geduldig und erklarst auch Grundlagen, wenn der Nutzer Anfanger ist.

DEINE GRENZEN UND UBERGANGSLOGIK:
- Du hilfst ZUERST ausfuhrlich selbst. Du bist kein Suchbot, sondern ein echter Berater.
- Erst wenn eine Aufgabe zu komplex fur einen Chat wird (z.B. Sicherheitsrisiken bei Elektrik/Gas, Bedarf an Live-Sicht auf das Problem, der Nutzer kommt alleine nicht weiter, oder der Nutzer explizit nach einem Experten fragt), dann schlage einen Live-Videocall mit einem Takumi-Experten vor.
- Wenn du einen Experten vorschlagst, fuege am Ende deiner Nachricht EXAKT diesen Marker ein (auf einer eigenen Zeile):
  [TAKUMI_TIP]
- Nutze diesen Marker NUR, wenn du wirklich einen Experten empfiehlst, nicht bei jeder Nachricht.
- Du empfiehlst einen Experten fruehestens nach 2-3 Austauschen, nie in der ersten Antwort.

STIL:
- Freundlich aber professionell
- Verwende gelegentlich Handwerker-Metaphern
- Gib immer das Gefuhl, dass du dich wirklich fur das Projekt interessierst
- Nutze Emoji sparsam (maximal 1-2 pro Nachricht, z.B. bei Warnungen)`

const LANGUAGE_INSTRUCTIONS: Record<string, string> = {
  de: "Du sprichst immer Deutsch.",
  en: "You always speak English.",
  es: "Siempre respondes en español.",
}

const USER_CONTEXT: Record<string, (name: string) => string> = {
  de: (name: string) => `Der aktuelle Nutzer heisst "${name}". Sprich ihn gelegentlich mit seinem Namen an.`,
  en: (name: string) => `The current user is named "${name}". Address them by name occasionally.`,
  es: (name: string) => `El usuario actual se llama "${name}". Dirígete a él/ella por su nombre ocasionalmente.`,
}

export async function POST(req: Request) {
  const ip = getClientIp(req)
  const rl = rateLimit(`chat:ip:${ip}`, { limit: 30, windowSec: 60 })
  if (!rl.success) {
    return Response.json(
      { error: "Zu viele Anfragen. Bitte warte kurz." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    )
  }

  const keyPresent = !!process.env.GOOGLE_GENERATIVE_AI_API_KEY
  if (!keyPresent) {
    return Response.json(
      { error: "GOOGLE_GENERATIVE_AI_API_KEY ist nicht gesetzt." },
      { status: 500 }
    )
  }

  try {
    const body = await req.json()
    const { messages, locale: reqLocale } = body as { messages: UIMessage[]; locale?: string }
    const locale = reqLocale && ["de", "en", "es"].includes(reqLocale) ? reqLocale : "de"

    const langInstruction = LANGUAGE_INSTRUCTIONS[locale] ?? LANGUAGE_INSTRUCTIONS.de

    let userContext = ""
    try {
      const session = await auth()
      if (session?.user?.name) {
        const userCtxFn = USER_CONTEXT[locale] ?? USER_CONTEXT.de
        userContext = `\n\n${userCtxFn(session.user.name)}`
      }
    } catch { /* not authenticated */ }

    let expertContext = ""
    try {
      const experts = await prisma.expert.findMany()
      if (experts.length > 0) {
        const list = experts
          .map(
            (e) =>
              `- ${e.name} (${e.subcategory}, ${e.categoryName}) | Bewertung: ${e.rating}/5 | ${e.sessionCount} Sessions | ${e.isLive ? "ONLINE" : "Offline"} | ${e.pricePerSession}EUR/30min`
          )
          .join("\n")
        expertContext = `\n\nAKTUELLE EXPERTEN-DATENBANK:\n${list}\n\nWenn du einen Experten empfiehlst, nutze die echten Namen und Daten aus dieser Liste.`
      }
    } catch { /* DB not available */ }

    const systemPrompt = SYSTEM_BASE + "\n- " + langInstruction + userContext + expertContext
    const result = streamText({
      model: "google/gemini-2.0-flash",
      system: systemPrompt,
      messages: await convertToModelMessages(messages),
      abortSignal: req.signal,
    })

    return result.toUIMessageStreamResponse({
      originalMessages: messages,
      consumeSseStream: consumeStream,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unbekannter Fehler"
    console.error("[diAiway] Chat API error:", message)
    return Response.json({ error: message }, { status: 500 })
  }
}
