/** Antwort von /api/upload robust parsen (413 liefert oft kein JSON → vermeidet „Netzwerkfehler“ durch JSON.parse). */
export async function parseUploadResponseJson(
  res: Response
): Promise<{ error?: string; url?: string }> {
  const text = await res.text()
  if (!text.trim()) {
    return { error: res.status === 413 ? "Datei zu groß für den Server." : `HTTP ${res.status}` }
  }
  try {
    return JSON.parse(text) as { error?: string; url?: string }
  } catch {
    return { error: res.status === 413 ? "Datei zu groß für den Server." : `HTTP ${res.status}` }
  }
}
