import { redirect } from "next/navigation"

/**
 * Der Vision Scanner ist jetzt im Admin-Dashboard als Tab integriert.
 */
export default function ScannerPage() {
  redirect("/admin#scanner")
}
