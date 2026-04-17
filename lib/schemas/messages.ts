import { z } from "zod"

/** POST /api/messages  (identisch zum bestehenden Inline-Schema, zentralisiert.) */
export const sendMessageSchema = z
  .object({
    recipientUserId: z.string().cuid().optional(),
    recipientExpertId: z.string().cuid().optional(),
    text: z.string().max(4000).optional(),
    subject: z.string().max(200).optional(),
    communicationType: z.enum(["CHAT", "MAIL"]).default("CHAT"),
    attachmentUrl: z.string().max(2048).optional(),
    attachmentThumbnailUrl: z.string().max(2048).optional(),
    attachmentFilename: z.string().max(200).optional(),
  })
  .refine(
    (d) => {
      const hasText = typeof d.text === "string" && d.text.trim().length >= 1
      const hasAttachment = typeof d.attachmentUrl === "string" && d.attachmentUrl.length > 0
      return hasText || hasAttachment
    },
    { message: "Nachricht oder Anhang erforderlich." }
  )
  .refine(
    (d) => {
      if (d.communicationType === "MAIL") {
        return typeof d.subject === "string" && d.subject.trim().length >= 1
      }
      return true
    },
    { message: "Waymail erfordert einen Betreff." }
  )

export type SendMessageInput = z.infer<typeof sendMessageSchema>
