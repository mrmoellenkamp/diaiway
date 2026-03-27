import { prisma } from "@/lib/db"

const baseUrl = process.env.NEXTAUTH_URL || "https://diaiway.com"
const expertsUrl = `${baseUrl}/takumis`

export async function seedCommunicationTemplates(): Promise<void> {
  const welcomeDe = `Hallo {{recipient_name}}!

Willkommen bei diAiway – deiner Plattform für Meisterwissen digital.

So startest du:

• **Experten finden**: Durchstöbere das Experten-Verzeichnis und finde Takumis für deine Themen.
• **Sessions buchen**: Wähle Video- oder Sprachanruf und buche direkt bei deinem Experten.
• **Chat & Waymails**: Chate live mit online Takumis oder sende formelle Waymails für Buchungs-Updates.

Experten-Verzeichnis: ${expertsUrl}

Viel Erfolg auf deiner Reise!
Dein diAiway-Team`

  const welcomeEn = `Hello {{recipient_name}}!

Welcome to diAiway – your platform for digital master knowledge.

Here's how to get started:

• **Find experts**: Browse the expert directory and find Takumis for your topics.
• **Book sessions**: Choose video or voice call and book directly with your expert.
• **Chat & Waymails**: Chat live with online Takumis or send formal Waymails for booking updates.

Expert directory: ${expertsUrl}

Best of luck on your journey!
The diAiway Team`

  const welcomeEs = `¡Hola {{recipient_name}}!

Bienvenido a diAiway – tu plataforma de conocimiento experto digital.

Así empiezas:

• **Encuentra expertos**: Explora el directorio de expertos y encuentra Takumis para tus temas.
• **Reserva sesiones**: Elige videollamada o llamada de voz y reserva directamente con tu experto.
• **Chat y Waymails**: Chatea en vivo con Takumis conectados o envía Waymails formales para actualizaciones de reservas.

Directorio de expertos: ${expertsUrl}

¡Mucho éxito en tu camino!
El equipo de diAiway`

  const tWelcome = await prisma.communicationTemplate.upsert({
    where: { slug: "welcome-mail" },
    create: {
      slug: "welcome-mail",
      category: "SYSTEM",
      availableVariables: ["recipient_name", "recipient_role"],
    },
    update: {},
  })

  for (const { language, subject, body } of [
    { language: "de", subject: "Willkommen bei diAiway – Dein Start", body: welcomeDe },
    { language: "en", subject: "Welcome to diAiway – Your Start", body: welcomeEn },
    { language: "es", subject: "Bienvenido a diAiway – Tu inicio", body: welcomeEs },
  ]) {
    await prisma.templateTranslation.upsert({
      where: { templateId_language: { templateId: tWelcome.id, language } },
      create: { templateId: tWelcome.id, language, subject, body },
      update: { subject, body },
    })
  }

  const tBooking = await prisma.communicationTemplate.upsert({
    where: { slug: "booking-request-paid" },
    create: {
      slug: "booking-request-paid",
      category: "BOOKING",
      availableVariables: ["sender_name", "recipient_name", "sender_role", "recipient_role", "booking_date", "service_name", "booking_time"],
    },
    update: {},
  })

  for (const { language, subject, body } of [
    { language: "de", subject: "Neue Buchungsanfrage (bezahlt)", body: "{{sender_name}} hat eine Session am {{booking_date}} von {{booking_time}} Uhr gebucht und bezahlt." },
    { language: "en", subject: "New booking request (paid)", body: "{{sender_name}} has booked and paid for a session on {{booking_date}} at {{booking_time}}." },
    { language: "es", subject: "Nueva solicitud de reserva (pagada)", body: "{{sender_name}} ha reservado y pagado una sesión el {{booking_date}} a las {{booking_time}}." },
  ]) {
    await prisma.templateTranslation.upsert({
      where: { templateId_language: { templateId: tBooking.id, language } },
      create: { templateId: tBooking.id, language, subject, body },
      update: { subject, body },
    })
  }

  // ── Gast-Call: Einladung an Gast ─────────────────────────────────────────
  const tGuestInvite = await prisma.communicationTemplate.upsert({
    where: { slug: "guest-call-invite" },
    create: {
      slug: "guest-call-invite",
      category: "BOOKING",
      availableVariables: ["takumi_name", "date", "start_time", "end_time", "price", "call_link", "host_message"],
    },
    update: {},
  })

  for (const { language, subject, body } of [
    {
      language: "de",
      subject: "Du hast eine Call-Einladung von {{takumi_name}} erhalten",
      body: `Hallo,

{{takumi_name}} hat dich zu einem persönlichen Call auf diAiway eingeladen.

Termin: {{date}}, {{start_time}} – {{end_time}} Uhr
Preis: {{price}} €

{{host_message}}

Klicke auf den Button, um deinen Termin zu bestätigen und zu bezahlen. Eine Registrierung ist nicht erforderlich.

{{call_link}}

Bitte halte diesen Link vertraulich – er ist nur für dich bestimmt.`,
    },
    {
      language: "en",
      subject: "You have received a call invitation from {{takumi_name}}",
      body: `Hello,

{{takumi_name}} has invited you to a personal call on diAiway.

Appointment: {{date}}, {{start_time}} – {{end_time}}
Price: {{price}} €

{{host_message}}

Click the button to confirm and pay for your appointment. No registration required.

{{call_link}}

Please keep this link confidential – it is intended for you only.`,
    },
    {
      language: "es",
      subject: "Has recibido una invitación de llamada de {{takumi_name}}",
      body: `Hola,

{{takumi_name}} te ha invitado a una llamada personal en diAiway.

Cita: {{date}}, {{start_time}} – {{end_time}}
Precio: {{price}} €

{{host_message}}

Haz clic en el botón para confirmar y pagar tu cita. No es necesario registrarse.

{{call_link}}

Por favor, mantén este enlace confidencial – es solo para ti.`,
    },
  ]) {
    await prisma.templateTranslation.upsert({
      where: { templateId_language: { templateId: tGuestInvite.id, language } },
      create: { templateId: tGuestInvite.id, language, subject, body },
      update: { subject, body },
    })
  }

  // ── Gast-Call: Bestätigung an Takumi ─────────────────────────────────────
  const tGuestConfirm = await prisma.communicationTemplate.upsert({
    where: { slug: "guest-call-confirm-takumi" },
    create: {
      slug: "guest-call-confirm-takumi",
      category: "BOOKING",
      availableVariables: ["takumi_name", "guest_email", "date", "start_time", "end_time", "price"],
    },
    update: {},
  })

  for (const { language, subject, body } of [
    {
      language: "de",
      subject: "Einladung an {{guest_email}} wurde versendet",
      body: `Hallo {{takumi_name}},

deine Gast-Einladung wurde erfolgreich versendet.

Gast: {{guest_email}}
Termin: {{date}}, {{start_time}} – {{end_time}} Uhr
Preis: {{price}} €

Der Gast erhält den Call-Link per E-Mail und kann direkt beitreten, sobald die Zahlung erfolgt ist. Du wirst benachrichtigt, sobald der Gast bezahlt hat.`,
    },
    {
      language: "en",
      subject: "Invitation to {{guest_email}} has been sent",
      body: `Hello {{takumi_name}},

your guest invitation has been successfully sent.

Guest: {{guest_email}}
Appointment: {{date}}, {{start_time}} – {{end_time}}
Price: {{price}} €

The guest will receive the call link by email and can join directly once payment is made. You will be notified as soon as the guest has paid.`,
    },
    {
      language: "es",
      subject: "La invitación a {{guest_email}} ha sido enviada",
      body: `Hola {{takumi_name}},

tu invitación de invitado se ha enviado correctamente.

Invitado: {{guest_email}}
Cita: {{date}}, {{start_time}} – {{end_time}}
Precio: {{price}} €

El invitado recibirá el enlace de la llamada por correo electrónico y podrá unirse directamente una vez realizado el pago. Recibirás una notificación cuando el invitado haya pagado.`,
    },
  ]) {
    await prisma.templateTranslation.upsert({
      where: { templateId_language: { templateId: tGuestConfirm.id, language } },
      create: { templateId: tGuestConfirm.id, language, subject, body },
      update: { subject, body },
    })
  }
}
