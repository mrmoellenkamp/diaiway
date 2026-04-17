import { z } from "zod"
import { imageUrlSchema } from "./common"

/** PATCH /api/user/profile */
export const patchProfileSchema = z
  .object({
    name: z.string().min(2).max(100).optional(),
    username: z.string().max(50).nullable().optional(),
    image: imageUrlSchema.optional(),
    appRole: z.enum(["shugyo", "takumi"]).optional(),
    refundPreference: z.enum(["payout", "wallet"]).optional(),
    invoiceData: z.unknown().optional(), // sanitize via lib/security.sanitizeInvoiceData
    skillLevel: z.enum(["NEULING", "FORTGESCHRITTEN", "PROFI"]).nullable().optional(),
    languages: z.array(z.string().max(5)).max(20).optional(),
    preferredLocale: z.string().max(5).optional(),
  })
  .strict()

export type PatchProfileInput = z.infer<typeof patchProfileSchema>
