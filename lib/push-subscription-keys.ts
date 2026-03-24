import { Buffer } from "node:buffer"

/**
 * Normalize p256dh/auth from PushSubscription (base64url) to standard base64
 * for node web-push / Buffer decoding.
 */
export function normalizeWebPushKey(key: string): string {
  const padLen = (4 - (key.length % 4)) % 4
  const padded = key + "=".repeat(padLen)
  const b64 = padded.replace(/-/g, "+").replace(/_/g, "/")
  return Buffer.from(b64, "base64").toString("base64")
}
