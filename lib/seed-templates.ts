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
}
