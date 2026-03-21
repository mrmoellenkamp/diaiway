/** Anpassen in .env: NEXT_PUBLIC_BETA_MAILTO="mailto:…" */
export function getBetaMailto(): string {
  const fromEnv = process.env.NEXT_PUBLIC_BETA_MAILTO
  if (fromEnv?.startsWith("mailto:")) return fromEnv
  return "mailto:admin@diaiway.com?subject=Beta-Test%20diAiway"
}
