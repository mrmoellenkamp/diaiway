import { z } from "zod"
import { cuidSchema, isoDateSchema, hhmmSchema } from "./common"

/**
 * POST /api/bookings
 *
 * WICHTIG: `totalPrice`/`price` werden hier zwar akzeptiert, in der Route
 * aber IGNORIERT.  Der Preis wird serverseitig aus Expert + Dauer neu
 * berechnet (Anti-Preis-Manipulation).
 */
export const createBookingSchema = z.object({
  takumiId: cuidSchema,
  date: isoDateSchema,
  startTime: hhmmSchema,
  endTime: hhmmSchema,
  callType: z.enum(["VIDEO", "VOICE"]).optional(),
  // Client-Werte werden nur als Hinweis übernommen; die Route rechnet neu.
  totalPrice: z.number().finite().nonnegative().max(1_000_000).optional(),
  price: z.number().finite().nonnegative().max(1_000_000).optional(),
  note: z.string().max(2_000, "Notiz darf höchstens 2000 Zeichen lang sein.").optional(),
  deferNotification: z.boolean().optional(),
})

export type CreateBookingInput = z.infer<typeof createBookingSchema>
