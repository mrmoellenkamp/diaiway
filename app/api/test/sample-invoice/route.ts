import { NextResponse } from "next/server"
import { generateInvoicePdf } from "@/lib/pdf-invoice"
import { transporter, smtpFrom } from "@/lib/email"

/**
 * GET /api/test/sample-invoice
 * Erzeugt eine Beispiel-ZUGFeRD-Rechnung.
 * Nur in Development (NODE_ENV !== "production") verfügbar.
 *
 * Query:
 *   - email=xxx  Wenn gesetzt und SMTP konfiguriert: Rechnung per E-Mail senden
 *
 * Response: PDF-Download (application/pdf)
 */
export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  try {
    const { searchParams } = new URL(req.url)
    const targetEmail = searchParams.get("email")

    const pdfBuf = await generateInvoicePdf({
      invoiceNumber: "RE-999999",
      recipientName: "Max Mustermann GmbH",
      recipientEmail: "rechnung@mustermann.de",
      recipientCustomerNumber: "KD-99999",
      bookingId: "bkl-example-001",
      expertName: "Maria Expertin",
      totalAmountCents: 5950,
      date: new Date(),
      durationMinutes: 30,
      useZugferd: true,
    })

    if (targetEmail && process.env.SMTP_HOST) {
      try {
        await transporter.sendMail({
          from: smtpFrom,
          to: targetEmail,
          subject: "diAiway – Beispiel ZUGFeRD-Rechnung",
          text: "Anbei finden Sie eine Beispiel-ZUGFeRD-Rechnung. Das PDF enthält maschinenlesbare Rechnungsdaten (Factur-X).",
          attachments: [
            {
              filename: "diAiway-Beispiel-ZUGFeRD-Rechnung.pdf",
              content: Buffer.from(pdfBuf),
            },
          ],
        })
      } catch (err) {
        console.error("Sample invoice email failed:", err)
        return NextResponse.json(
          { error: "E-Mail konnte nicht versendet werden. SMTP prüfen." },
          { status: 500 }
        )
      }
    }

    return new NextResponse(Buffer.from(pdfBuf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="diAiway-Beispiel-ZUGFeRD-Rechnung.pdf"',
      },
    })
  } catch (e) {
    console.error("Sample invoice error:", e)
    return NextResponse.json({ error: "Rechnung konnte nicht erstellt werden." }, { status: 500 })
  }
}
