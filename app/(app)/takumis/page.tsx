import { redirect } from "next/navigation"

/** Experten-Verzeichnis: Weiterleitung zur Kategorien-Übersicht */
export default function TakumisPage() {
  redirect("/categories")
}
