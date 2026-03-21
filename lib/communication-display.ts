/**
 * Anzeige in Nutzer-zu-Nutzer-Kommunikation (Chat, Waymail, Gegenpart in Buchungen, Push, …):
 * ausschließlich Benutzername — kein Klarnamen-Fallback aus `User.name`.
 */

export const COMM_SYSTEM_SENDER_LABEL = "diAiway System"

export function isSystemWaymailSender(
  senderId: string | null | undefined,
  senderDisplayName?: string | null,
): boolean {
  return senderId == null || senderDisplayName === COMM_SYSTEM_SENDER_LABEL
}

/** Sichtbarer Kommunikationsname; ohne gesetzten Username: neutraler Platzhalter. */
export function communicationUsername(username: string | null | undefined, fallback = "Nutzer"): string {
  const t = typeof username === "string" ? username.trim() : ""
  return t.length > 0 ? t : fallback
}

/** Anrede in transaktionalen E-Mails: nur Username, sonst lokaler Teil der E-Mail. */
export function emailSalutationFromUser(u: { username?: string | null; email: string }): string {
  const local = u.email.includes("@") ? (u.email.split("@")[0] ?? "").trim() : u.email.trim()
  return communicationUsername(u.username, local || "Nutzer")
}

/** Listen, Karten, Profilkopf: öffentlicher Takumi-Name = Benutzername. */
export function takumiPublicLabel(takumi: { username?: string | null; name?: string }): string {
  return communicationUsername(takumi.username, "Takumi")
}

/** Waymail-Absenderzeile: System-Label beibehalten, sonst nur Username. */
export function waymailSenderLabel(
  senderId: string | null | undefined,
  senderDisplayName: string | null | undefined,
  senderUsername: string | null | undefined,
  fallback = "Nutzer",
): string {
  if (isSystemWaymailSender(senderId, senderDisplayName)) {
    return senderDisplayName?.trim() || COMM_SYSTEM_SENDER_LABEL
  }
  return communicationUsername(senderUsername, fallback)
}
