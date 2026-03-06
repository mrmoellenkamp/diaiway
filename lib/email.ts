import nodemailer from "nodemailer"

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
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
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
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
  date: string
  startTime: string
  endTime: string
  acceptUrl: string
  declineUrl: string
}) {
  const body = `
    <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#78716c;">
      Hallo <strong style="color:#1c1917;">${opts.takumiName}</strong>,<br/>
      <strong style="color:#1c1917;">${opts.userName}</strong> moechte eine Session mit dir buchen:
    </p>
    <table role="presentation" width="100%" style="background:#f5f5f4;border-radius:12px;margin-bottom:24px;">
      <tr><td style="padding:16px 20px;">
        <p style="margin:0;font-size:13px;color:#1c1917;"><strong>Datum:</strong> ${opts.date}</p>
        <p style="margin:4px 0 0;font-size:13px;color:#1c1917;"><strong>Zeit:</strong> ${opts.startTime} - ${opts.endTime}</p>
      </td></tr>
    </table>
    <div style="text-align:center;padding:8px 0;">
      ${btn(opts.acceptUrl, "Annehmen", "#064e3b")}
      ${btn(opts.declineUrl, "Ablehnen", "#dc2626")}
    </div>`
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: opts.to,
    subject: `diAiway - Neue Buchungsanfrage von ${opts.userName}`,
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
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: opts.to,
    subject: `diAiway - Buchung ${statusLabel}`,
    html: emailWrapper(title, body),
  })
}
