import { z } from "zod"

/** POST /api/upload  (Profil-/Gallerie-Bilder) */
export const uploadFolderSchema = z.enum([
  "profiles",
  "experts",
  "uploads",
  "shugyo-projects",
  "takumi-portfolio",
])

export type UploadFolder = z.infer<typeof uploadFolderSchema>
