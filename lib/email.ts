import nodemailer from "nodemailer"

// Support both naming conventions (Vercel env pull uses EMAIL_SERVER_*, legacy uses SMTP_*)
const smtpHost     = process.env.EMAIL_SERVER_HOST     || process.env.SMTP_HOST     || ""
const smtpPort     = Number(process.env.EMAIL_SERVER_PORT || process.env.SMTP_PORT) || 587
const smtpUser     = process.env.EMAIL_SERVER_USER     || process.env.SMTP_USER     || ""
const smtpPassword = process.env.EMAIL_SERVER_PASSWORD || process.env.SMTP_PASSWORD || ""
export const smtpFrom = process.env.EMAIL_FROM            || process.env.SMTP_FROM     || smtpUser

export const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: smtpPort === 465,
  auth: {
    user: smtpUser,
    pass: smtpPassword,
  },
})

export async function sendPasswordResetEmail(
  to: string,
  name: string,
  resetUrl: string
) {
  const html = `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background-color:#fafaf9;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fafaf9;padding:40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#064e3b 0%,#065f46 100%);padding:32px 40px;text-align:center;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <div style="display:inline-block;width:48px;height:48px;line-height:48px;border-radius:12px;background-color:rgba(255,255,255,0.15);text-align:center;font-size:18px;font-weight:700;color:#f59e0b;">di</div>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top:12px;">
                    <span style="font-size:22px;font-weight:700;color:#f0fdf4;">di<span style="color:#f59e0b;">Ai</span>way</span>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top:4px;">
                    <span style="font-size:12px;color:rgba(240,253,244,0.7);letter-spacing:1px;">MEISTERWISSEN DIGITAL</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#1c1917;">Passwort zuruecksetzen</h1>
              <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#78716c;">
                Hallo <strong style="color:#1c1917;">${name}</strong>,<br/>
                du hast eine Anfrage zum Zuruecksetzen deines Passworts gesendet. Klicke auf den Button, um ein neues Passwort zu vergeben.
              </p>

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 32px;">
                    <a href="${resetUrl}" target="_blank" style="display:inline-block;padding:14px 40px;background-color:#064e3b;color:#f0fdf4;font-size:15px;font-weight:600;text-decoration:none;border-radius:12px;box-shadow:0 4px 12px rgba(6,78,59,0.3);">
                      Neues Passwort vergeben
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Info box -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f4;border-radius:12px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0;font-size:12px;line-height:1.6;color:#78716c;">
                      Dieser Link ist <strong style="color:#1c1917;">1 Stunde</strong> gueltig. Wenn du kein neues Passwort angefordert hast, kannst du diese E-Mail einfach ignorieren.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Fallback URL -->
              <p style="margin:24px 0 0;font-size:11px;line-height:1.5;color:#a8a29e;word-break:break-all;">
                Falls der Button nicht funktioniert, kopiere diesen Link:<br/>
                <a href="${resetUrl}" style="color:#064e3b;text-decoration:underline;">${resetUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px 28px;border-top:1px solid #e7e5e3;text-align:center;">
              <p style="margin:0;font-size:11px;color:#a8a29e;">
                &copy; ${new Date().getFullYear()} diAiway &middot; Meisterwissen auf Abruf
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  await transporter.sendMail({
    from: smtpFrom,
    to,
    subject: "diAiway - Passwort zuruecksetzen",
    html,
  })
}

/* ----- Shared email wrapper ----- */
function emailWrapper(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="de"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background-color:#fafaf9;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fafaf9;padding:40px 20px;"><tr><td align="center">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
<tr><td style="background:linear-gradient(135deg,#064e3b 0%,#065f46 100%);padding:24px 40px;text-align:center;">
  <span style="font-size:20px;font-weight:700;color:#f0fdf4;">di<span style="color:#f59e0b;">Ai</span>way</span>
  <br/><span style="font-size:11px;color:rgba(240,253,244,0.6);letter-spacing:1px;">MEISTERWISSEN DIGITAL</span>
</td></tr>
<tr><td style="padding:32px 40px;">
  <h1 style="margin:0 0 16px;font-size:18px;font-weight:700;color:#1c1917;">${title}</h1>
  ${body}
</td></tr>
<tr><td style="padding:16px 40px 20px;border-top:1px solid #e7e5e3;text-align:center;">
  <p style="margin:0;font-size:11px;color:#a8a29e;">&copy; ${new Date().getFullYear()} diAiway</p>
</td></tr>
</table></td></tr></table></body></html>`
}

function btn(href: string, label: string, color: string): string {
  return `<a href="${href}" style="display:inline-block;padding:12px 28px;background-color:${color};color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:10px;margin-right:8px;">${label}</a>`
}

/* ----- Booking request email to Takumi ----- */
export async function sendBookingRequestEmail(opts: {
  to: string
  takumiName: string
  userName: string
  userEmail: string
  date: string
  startTime: string
  endTime: string
  price: number
  note?: string
  acceptUrl: string
  declineUrl: string
  askUrl: string
  dashboardUrl: string
}) {
  const noteBlock = opts.note?.trim()
    ? `<p style="margin:8px 0 0;font-size:13px;color:#1c1917;"><strong>Nachricht:</strong> ${opts.note}</p>`
    : ""

  const body = `
    <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#78716c;">
      Hallo <strong style="color:#1c1917;">${opts.takumiName}</strong>,<br/>
      du hast eine neue Buchungsanfrage von <strong style="color:#1c1917;">${opts.userName}</strong>.
      Bitte bestätige oder lehne sie ab.
    </p>

    <table role="presentation" width="100%" style="background:#f5f5f4;border-radius:12px;margin-bottom:24px;">
      <tr><td style="padding:20px;">
        <p style="margin:0;font-size:13px;color:#1c1917;"><strong>Von:</strong> ${opts.userName} (${opts.userEmail})</p>
        <p style="margin:6px 0 0;font-size:13px;color:#1c1917;"><strong>Datum:</strong> ${opts.date}</p>
        <p style="margin:4px 0 0;font-size:13px;color:#1c1917;"><strong>Zeit:</strong> ${opts.startTime}–${opts.endTime} Uhr</p>
        <p style="margin:4px 0 0;font-size:13px;color:#1c1917;"><strong>Preis:</strong> ${opts.price} €</p>
        ${noteBlock}
      </td></tr>
    </table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
      <tr>
        <td style="padding:4px;">
          <a href="${opts.acceptUrl}" style="display:block;text-align:center;padding:13px 0;background-color:#064e3b;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:10px;">
            ✓ Buchung annehmen
          </a>
        </td>
      </tr>
      <tr>
        <td style="padding:4px;">
          <a href="${opts.declineUrl}" style="display:block;text-align:center;padding:13px 0;background-color:#dc2626;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:10px;">
            ✕ Buchung ablehnen
          </a>
        </td>
      </tr>
      <tr>
        <td style="padding:4px;">
          <a href="${opts.askUrl}" style="display:block;text-align:center;padding:13px 0;background-color:#f5f5f4;color:#1c1917;font-size:14px;font-weight:600;text-decoration:none;border-radius:10px;border:1px solid #e7e5e3;">
            ? Rückfrage stellen
          </a>
        </td>
      </tr>
    </table>

    <p style="margin:16px 0 0;font-size:12px;text-align:center;color:#a8a29e;">
      Oder öffne dein <a href="${opts.dashboardUrl}" style="color:#064e3b;text-decoration:underline;">diAiway-Dashboard</a>, um alle Buchungen zu verwalten.
    </p>`

  await transporter.sendMail({
    from: smtpFrom,
    to: opts.to,
    replyTo: opts.userEmail,
    subject: `diAiway – Neue Buchungsanfrage von ${opts.userName}`,
    html: emailWrapper("Neue Buchungsanfrage", body),
  })
}

/* ----- Booking status email to User ----- */
export async function sendBookingStatusEmail(opts: {
  to: string
  userName: string
  takumiName: string
  date: string
  startTime: string
  endTime: string
  status: "confirmed" | "declined"
}) {
  const isConfirmed = opts.status === "confirmed"
  const title = isConfirmed ? "Buchung bestaetigt!" : "Buchung abgelehnt"
  const statusColor = isConfirmed ? "#064e3b" : "#dc2626"
  const statusLabel = isConfirmed ? "Bestaetigt" : "Abgelehnt"
  const message = isConfirmed
    ? `Gute Nachricht! <strong style="color:#1c1917;">${opts.takumiName}</strong> hat deine Buchung angenommen. Bereite dich auf deine Session vor.`
    : `Leider hat <strong style="color:#1c1917;">${opts.takumiName}</strong> die Buchung abgelehnt. Bitte waehle einen anderen Termin oder Experten.`

  const body = `
    <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#78716c;">
      Hallo <strong style="color:#1c1917;">${opts.userName}</strong>,<br/>${message}
    </p>
    <table role="presentation" width="100%" style="background:#f5f5f4;border-radius:12px;margin-bottom:16px;">
      <tr><td style="padding:16px 20px;">
        <p style="margin:0;font-size:13px;color:#1c1917;"><strong>Experte:</strong> ${opts.takumiName}</p>
        <p style="margin:4px 0 0;font-size:13px;color:#1c1917;"><strong>Datum:</strong> ${opts.date}</p>
        <p style="margin:4px 0 0;font-size:13px;color:#1c1917;"><strong>Zeit:</strong> ${opts.startTime} - ${opts.endTime}</p>
        <p style="margin:8px 0 0;font-size:13px;"><span style="display:inline-block;padding:2px 10px;border-radius:6px;background-color:${statusColor};color:#fff;font-size:12px;font-weight:600;">${statusLabel}</span></p>
      </td></tr>
    </table>`
  await transporter.sendMail({
    from: smtpFrom,
    to: opts.to,
    subject: `diAiway - Buchung ${statusLabel}`,
    html: emailWrapper(title, body),
  })
}

/* ----- Rechnung bereit (Shugyo) ----- */
export async function sendInvoiceReadyEmail(opts: {
  to: string
  userName: string
  downloadUrl: string
  isBusiness: boolean
  invoiceNumber: string
  expertName: string
  date: string
}): Promise<{ sent: boolean; error?: string }> {
  const hint = opts.isBusiness
    ? "Ihre Rechnung liegt im ZUGFeRD-Format (E-Rechnung B2B) im diAiway-Portal für Sie bereit."
    : "Ihr Beleg ist im diAiway-Portal für Sie abrufbar."

  const body = `
    <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#78716c;">
      Hallo <strong style="color:#1c1917;">${opts.userName}</strong>,<br/>
      die Zahlung für Ihre Session mit <strong style="color:#1c1917;">${opts.expertName}</strong> (${opts.date}) wurde abgeschlossen.
    </p>
    <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#78716c;">
      ${hint}
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="padding:8px 0 24px;">
          <a href="${opts.downloadUrl}" target="_blank" style="display:inline-block;padding:14px 36px;background-color:#064e3b;color:#f0fdf4;font-size:15px;font-weight:600;text-decoration:none;border-radius:12px;box-shadow:0 4px 12px rgba(6,78,59,0.3);">
            Rechnung herunterladen
          </a>
        </td>
      </tr>
    </table>
    <p style="margin:0;font-size:12px;color:#a8a29e;">
      Rechnungsnummer: ${opts.invoiceNumber}
    </p>`

  try {
    await transporter.sendMail({
      from: smtpFrom,
      to: opts.to,
      subject: `diAiway – Ihre Rechnung ${opts.invoiceNumber} ist bereit`,
      html: emailWrapper("Rechnung bereit", body),
    })
    return { sent: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown"
    return { sent: false, error: msg }
  }
}

/* ----- Gutschrift bereit (Takumi) ----- */
export async function sendCreditNoteReadyEmail(opts: {
  to: string
  takumiName: string
  downloadUrl: string
  isBusiness: boolean
  creditNoteNumber: string
  userName: string
  date: string
}): Promise<{ sent: boolean; error?: string }> {
  const hint = opts.isBusiness
    ? "Ihre Gutschrift liegt im ZUGFeRD-Format (E-Rechnung B2B) im diAiway-Portal für Sie bereit."
    : "Ihr Beleg ist im diAiway-Portal für Sie abrufbar."

  const body = `
    <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#78716c;">
      Hallo <strong style="color:#1c1917;">${opts.takumiName}</strong>,<br/>
      die Gutschrift für die Session mit <strong style="color:#1c1917;">${opts.userName}</strong> (${opts.date}) wurde erstellt.
    </p>
    <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#78716c;">
      ${hint}
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="padding:8px 0 24px;">
          <a href="${opts.downloadUrl}" target="_blank" style="display:inline-block;padding:14px 36px;background-color:#064e3b;color:#f0fdf4;font-size:15px;font-weight:600;text-decoration:none;border-radius:12px;box-shadow:0 4px 12px rgba(6,78,59,0.3);">
            Gutschrift herunterladen
          </a>
        </td>
      </tr>
    </table>
    <p style="margin:0;font-size:12px;color:#a8a29e;">
      Gutschriftsnummer: ${opts.creditNoteNumber}
    </p>`

  try {
    await transporter.sendMail({
      from: smtpFrom,
      to: opts.to,
      subject: `diAiway – Ihre Gutschrift ${opts.creditNoteNumber} ist bereit`,
      html: emailWrapper("Gutschrift bereit", body),
    })
    return { sent: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown"
    return { sent: false, error: msg }
  }
}
