import { NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { transporter, smtpFrom } from "@/lib/email"
import {
  generateInvoicePdf,
  generateWalletTopupInvoicePdf,
  pdfDemoRecipientInvoiceData,
} from "@/lib/pdf-invoice"

export const runtime = "nodejs"

const bodySchema = z.object({
  email: z.string().email(),
  doc: z.enum(["re_session", "re_wallet"]).default("re_session"),
  /** Nur bei re_session; bei re_wallet wird ignoriert */
  zugferd: z.boolean().optional().default(false),
})

/**
 * POST /api/admin/invoice-branding/test-email
 * Sendet eine Muster-Rechnung (aktuelles Branding aus DB) als PDF-Anhang.
 */
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 })
  }
  const role = (session.user as { role?: string }).role
  if (role !== "admin") {
    return NextResponse.json({ error: "Kein Admin." }, { status: 403 })
  }
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  })
  if (!dbUser || dbUser.role !== "admin") {
    return NextResponse.json({ error: "Kein Admin." }, { status: 403 })
  }

  const smtpHost = process.env.EMAIL_SERVER_HOST || process.env.SMTP_HOST || ""
  if (!smtpHost) {
    return NextResponse.json(
      { error: "E-Mail-Versand nicht konfiguriert (SMTP_HOST / EMAIL_SERVER_HOST)." },
      { status: 400 }
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungültige Eingabe.", details: parsed.error.flatten() }, { status: 400 })
  }

  const { email, doc, zugferd } = parsed.data
  const demoDate = new Date()

  try {
    let pdfBuf: ArrayBuffer
    let filename: string
    let subject: string

    if (doc === "re_wallet") {
      pdfBuf = await generateWalletTopupInvoicePdf({
        invoiceNumber: "RE-TEST-WALLET",
        recipientName: "Musterfirma GmbH",
        recipientEmail: "rechnung@beispiel.de",
        recipientCustomerNumber: "KD-TEST",
        recipientCountry: "Germany",
        recipientInvoiceData: pdfDemoRecipientInvoiceData,
        amountCents: 10000,
        date: demoDate,
        introGreeting: { firstName: "Max", lastName: "Mustermann", username: "muster_max" },
      })
      filename = "diaiway-test-wallet-rechnung.pdf"
      subject = "diAiway – Test-Rechnung (Wallet-Aufladung)"
    } else {
      const useZug = Boolean(zugferd)
      pdfBuf = await generateInvoicePdf({
        invoiceNumber: "RE-TEST-SESSION",
        recipientName: "Musterfirma GmbH",
        recipientEmail: "rechnung@beispiel.de",
        recipientCustomerNumber: "KD-TEST",
        recipientCountry: "Germany",
        recipientInvoiceData: pdfDemoRecipientInvoiceData,
        bookingId: "bkl-test-demo",
        expertName: "Expertin Muster",
        totalAmountCents: 5950,
        date: demoDate,
        durationMinutes: 30,
        useZugferd: useZug,
        introGreeting: { firstName: "Max", lastName: "Mustermann", username: "muster_max" },
      })
      filename = useZug
        ? "diaiway-test-session-zugferd.pdf"
        : "diaiway-test-session-rechnung.pdf"
      subject = useZug
        ? "diAiway – Test-Rechnung (Session, ZUGFeRD)"
        : "diAiway – Test-Rechnung (Session)"
    }

    await transporter.sendMail({
      from: smtpFrom,
      to: email,
      subject,
      text:
        "Anbei eine Test-Rechnung aus dem Admin-Panel (Rechnungs-PDF). Daten sind Beispielwerte; Layout und Texte entsprechen dem gespeicherten Branding.",
      attachments: [{ filename, content: Buffer.from(pdfBuf), contentType: "application/pdf" }],
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("[invoice-branding/test-email]", e)
    return NextResponse.json(
      { error: "PDF-Erzeugung oder E-Mail-Versand fehlgeschlagen." },
      { status: 500 }
    )
  }
}
