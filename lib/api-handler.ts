/**
 * Zentrale API-Error-Handling-Infrastruktur.
 * Eliminiert redundante try-catch-Blöcke und ermöglicht einheitliche UI-Feedbacks.
 */

import { NextResponse } from "next/server"
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library"
import { ZodError } from "zod"
import { sanitizeErrorForClient } from "@/lib/security"

/** Next.js App Router: context ist immer vorhanden (params als Promise). */
export type RouteContext = { params: Promise<Record<string, string | string[]>> }

export type ApiHandlerFn = (
  req: Request,
  context: RouteContext
) => Promise<NextResponse>

/**
 * Higher-Order Function: Umschließt API-Handler mit zentralem try-catch.
 * Alle geworfenen Fehler werden an translateError weitergeleitet.
 */
export function apiHandler(handler: ApiHandlerFn) {
  return async (req: Request, context: RouteContext): Promise<NextResponse> => {
    try {
      return await handler(req, context)
    } catch (err) {
      return translateError(err)
    }
  }
}

/**
 * Übersetzt Fehler in einheitliche API-Responses.
 * - Prisma P2002 (Unique) → { error: "Bereits vergeben", field }
 * - Prisma P2025 (Not found) → 404
 * - ZodError → { error: "Validierungsfehler", details }
 * - Allgemein: saubere Nachricht, interne Details in Production versteckt
 */
export function translateError(err: unknown): NextResponse {
  // Prisma: Unique Constraint
  if (err instanceof PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      const targets = (err.meta?.target as string[] | undefined) ?? []
      const field = targets[0] ?? "unbekannt"
      return NextResponse.json(
        { error: "Bereits vergeben", field, message: `Dieses Feld ist bereits vergeben.` },
        { status: 409 }
      )
    }
    if (err.code === "P2025") {
      return NextResponse.json({ error: "Datensatz nicht gefunden." }, { status: 404 })
    }
    if (err.code === "P2000") {
      const field = (err.meta?.column_name as string | undefined) ?? "unbekannt"
      return NextResponse.json(
        { error: "Validierungsfehler", field, message: `Der Wert für „${field}" ist zu lang.` },
        { status: 400 }
      )
    }
    if (err.code === "P2003") {
      return NextResponse.json(
        { error: "Validierungsfehler", message: "Ein referenzierter Datensatz wurde nicht gefunden." },
        { status: 400 }
      )
    }
  }

  // Slot-Konflikt (Buchung)
  if (err instanceof Error && err.message === "SLOT_CONFLICT") {
    return NextResponse.json({ error: "Dieser Zeitraum ist bereits belegt." }, { status: 409 })
  }

  // Zod: Validierungsfehler
  if (err instanceof ZodError) {
    const details = err.issues.map((i) => ({
      field: i.path.join(".") || undefined,
      message: i.message,
    }))
    return NextResponse.json(
      { error: "Validierungsfehler", details },
      { status: 400 }
    )
  }

  // Allgemein: sichere Nachricht in Production
  const message = process.env.NODE_ENV === "production"
    ? "Ein Fehler ist aufgetreten."
    : sanitizeErrorForClient(err)
  return NextResponse.json({ error: message }, { status: 500 })
}
