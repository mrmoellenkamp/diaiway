/**
 * Erkennt, ob die Langbeschreibung so geändert wurde, dass eine Admin-Nachprüfung nötig ist.
 */

function normalizeWords(s: string): string[] {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .split(" ")
    .filter(Boolean)
}

export function isBioChangeSignificant(workingBio: string, approvedBioLive: string): boolean {
  const a = workingBio.trim().replace(/\s+/g, " ")
  const b = approvedBioLive.trim().replace(/\s+/g, " ")
  if (a === b) return false
  if (!b && a) return true

  const aw = normalizeWords(a)
  const bw = normalizeWords(b)
  if (aw.length === 0 && bw.length === 0) return false
  const bs = new Set(bw)
  let inter = 0
  for (const w of aw) {
    if (bs.has(w)) inter++
  }
  const union = aw.length + bw.length - inter
  const jaccard = union ? inter / union : 0
  const lenRatio = Math.abs(a.length - b.length) / Math.max(a.length, b.length, 1)

  return jaccard < 0.72 || lenRatio > 0.38
}
