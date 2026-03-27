/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * SMTP-Check: nodemailer.verify() gegen EMAIL_SERVER_* / SMTP_*.
 * Aufruf:
 *   node --env-file=.env.local --env-file=.env scripts/verify-smtp.cjs
 */
const nodemailer = require("nodemailer")

const smtpHost =
  process.env.EMAIL_SERVER_HOST || process.env.SMTP_HOST || ""
const smtpPort = Number(process.env.EMAIL_SERVER_PORT || process.env.SMTP_PORT) || 587
const smtpUser =
  process.env.EMAIL_SERVER_USER || process.env.SMTP_USER || ""
const smtpPassword =
  process.env.EMAIL_SERVER_PASSWORD || process.env.SMTP_PASSWORD || ""

if (!smtpHost.trim()) {
  console.error(
    "FAIL: Kein SMTP-Host. Setze EMAIL_SERVER_HOST oder SMTP_HOST in .env / .env.local."
  )
  process.exit(1)
}

const hasAuth = !!(smtpUser && smtpPassword)
const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: smtpPort === 465,
  ...(hasAuth ? { auth: { user: smtpUser, pass: smtpPassword } } : {}),
})

transporter.verify((err) => {
  if (err) {
    console.error("FAIL: SMTP verify() fehlgeschlagen.")
    console.error(err.message || String(err))
    process.exit(1)
  }
  console.log(
    "OK: SMTP-Verbindung (und ggf. Login) erfolgreich. Host=" +
      smtpHost +
      " Port=" +
      smtpPort +
      (hasAuth ? " (Auth: ja)" : " (Auth: nein)")
  )
  process.exit(0)
})
