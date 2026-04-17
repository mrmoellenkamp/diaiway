import { z } from "zod"

/** Vercel Blob Storage: erlaubte Hosts für user-provided Image-URLs. */
export const ALLOWED_IMAGE_HOSTS = [
  "blob.vercel-storage.com",
  "public.blob.vercel-storage.com",
]

/** Erlaubte Suffixe (z. B. `xxx.blob.vercel-storage.com`). */
const ALLOWED_IMAGE_SUFFIXES = [".blob.vercel-storage.com"]

/** Leerer String → undefined → optional. */
export const emptyToUndefined = z
  .string()
  .transform((v) => (v.trim() === "" ? undefined : v.trim()))

/**
 * Validiert, dass eine URL entweder leer ist oder zu einem erlaubten Host gehört.
 * Signierte Proxy-URLs (`/api/files/signed?...`) sind ebenfalls erlaubt.
 */
export const imageUrlSchema = z
  .string()
  .max(2048)
  .refine(
    (v) => {
      if (v === "" || v == null) return true
      // relative Proxy-URLs von uns selbst:
      if (v.startsWith("/api/files/signed?")) return true
      try {
        const u = new URL(v)
        if (u.protocol !== "https:") return false
        const host = u.hostname.toLowerCase()
        if (ALLOWED_IMAGE_HOSTS.includes(host)) return true
        return ALLOWED_IMAGE_SUFFIXES.some((suffix) => host.endsWith(suffix))
      } catch {
        return false
      }
    },
    { message: "Bild-URL nicht erlaubt (nur Vercel-Blob-Storage)." }
  )

/** CUID v1/v2, wie von Prisma generiert. */
export const cuidSchema = z.string().min(10).max(40)

/** Datum im Format YYYY-MM-DD */
export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Datum muss YYYY-MM-DD sein.")

/** Zeit im Format HH:MM (24h) */
export const hhmmSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Zeit muss HH:MM sein.")
