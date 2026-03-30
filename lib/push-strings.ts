import type { AppLocale } from "@/lib/i18n/types"

/** Replace `{key}` placeholders */
export function interpolate(template: string, vars: Record<string, string>): string {
  let out = template
  for (const [k, val] of Object.entries(vars)) {
    out = out.split(`{${k}}`).join(val)
  }
  return out
}

type Row = Record<string, string>

const de: Row = {
  newWaymailTitle: "Neue Waymail",
  sessionReminderUserInappTitle: "Erinnerung: Deine Session startet gleich",
  sessionReminderUserInappBody: "In etwa 5 Minuten startet deine Session mit {partnerName}.",
  sessionReminderUserPushTitle: "Session startet in 5 Minuten",
  sessionReminderUserPushBody: "Mit {partnerName} um {time} Uhr",
  sessionReminderExpertInappTitle: "Erinnerung: Session startet gleich",
  sessionReminderExpertInappBody: "In etwa 5 Minuten startet deine Session mit {partnerName}.",
  sessionReminderExpertPushTitle: "Session startet in 5 Minuten",
  sessionReminderExpertPushBody: "Mit {partnerName} um {time} Uhr",
  partnerWaitingTitle: "Terminpartner ist im Videocall",
  partnerWaitingBody: "{name} wartet in eurem gebuchten Videogespräch.",
  partnerJoinedTitle: "Terminpartner ist dabei",
  partnerJoinedBody: "{name} ist dem Videogespräch beigetreten.",
  bookingPaidPushTitle: "Neue Buchung (bezahlt)",
  bookingPaidPushBody: "{shugyoName} hat am {date} um {time} Uhr gebucht.",
  bookingCancelledTitle: "Buchung storniert",
  bookingCancelledBody:
    "Deine Buchung am {date} um {time} Uhr wurde von {cancelledByName} storniert.",
  chatWritingTitle: "{sender} schreibt dir…",
  waymailFromTitle: "Waymail von {sender}",
  instantExpiredPushTitle: "Keine Antwort",
  instantExpiredPushBody: "Aktuell kein Experte verfügbar. Deine Mittel wurden freigegeben.",
  instantExpiredWaymailSubject: "Kein Experte verfügbar",
  instantExpiredWaymailBody: "Aktuell kein Experte verfügbar. Deine Mittel wurden freigegeben.",
  bookingRequestUnpaidTitle: "Neue Buchungsanfrage",
  bookingRequestUnpaidBody: "{shugyoName} möchte am {date} von {timeRange} Uhr buchen.",
  instantRequestTitle: "Instant-Anfrage",
  instantRequestBody: "{userName} möchte mit dir verbinden.",
  bookingConfirmedTitle: "Buchung bestätigt",
  bookingConfirmedBody:
    "{takumiName} hat deine Buchung am {date} ({timeRange}) bestätigt.",
  bookingDeclinedTitle: "Buchung abgelehnt",
  bookingDeclinedBody: "{takumiName} hat deine Buchungsanfrage am {date} leider abgelehnt.",
  bookingQuestionTitle: "Rückfrage zu deiner Buchung",
  bookingQuestionBody: "{takumiName} hat eine Rückfrage gestellt: {snippet}",
  sessionCompletedTitle: "Session abgeschlossen",
  sessionCompletedBody: "Deine Session mit {takumiName} wurde abgerechnet. Deine Rechnung ist verfügbar.",
  paymentFailedTitle: "Zahlung fehlgeschlagen",
  paymentFailedBody: "Deine Zahlung für die Buchung konnte nicht verarbeitet werden. Bitte prüfe deine Zahlungsmethode.",
  walletTopupTitle: "Guthaben aufgeladen",
  walletTopupBody: "{amount} € wurden deinem Guthaben gutgeschrieben.",
}

const en: Row = {
  newWaymailTitle: "New Waymail",
  sessionReminderUserInappTitle: "Reminder: your session starts soon",
  sessionReminderUserInappBody: "In about 5 minutes your session with {partnerName} starts.",
  sessionReminderUserPushTitle: "Session starts in 5 minutes",
  sessionReminderUserPushBody: "With {partnerName} at {time}",
  sessionReminderExpertInappTitle: "Reminder: session starts soon",
  sessionReminderExpertInappBody: "In about 5 minutes your session with {partnerName} starts.",
  sessionReminderExpertPushTitle: "Session starts in 5 minutes",
  sessionReminderExpertPushBody: "With {partnerName} at {time}",
  partnerWaitingTitle: "Your appointment partner is in the video call",
  partnerWaitingBody: "{name} is waiting in your booked video session.",
  partnerJoinedTitle: "Your appointment partner has joined",
  partnerJoinedBody: "{name} has joined the video session.",
  bookingPaidPushTitle: "New booking (paid)",
  bookingPaidPushBody: "{shugyoName} booked on {date} at {time}.",
  bookingCancelledTitle: "Booking cancelled",
  bookingCancelledBody: "Your booking on {date} at {time} was cancelled by {cancelledByName}.",
  chatWritingTitle: "{sender} is messaging you…",
  waymailFromTitle: "Waymail from {sender}",
  instantExpiredPushTitle: "No response",
  instantExpiredPushBody: "No expert is available right now. Your funds have been released.",
  instantExpiredWaymailSubject: "No expert available",
  instantExpiredWaymailBody: "No expert is available right now. Your funds have been released.",
  bookingRequestUnpaidTitle: "New booking request",
  bookingRequestUnpaidBody: "{shugyoName} wants to book on {date} from {timeRange}.",
  instantRequestTitle: "Instant request",
  instantRequestBody: "{userName} wants to connect with you.",
  bookingConfirmedTitle: "Booking confirmed",
  bookingConfirmedBody: "{takumiName} confirmed your booking on {date} ({timeRange}).",
  bookingDeclinedTitle: "Booking declined",
  bookingDeclinedBody: "{takumiName} declined your booking request for {date}.",
  bookingQuestionTitle: "Question about your booking",
  bookingQuestionBody: "{takumiName} asked a question: {snippet}",
  sessionCompletedTitle: "Session completed",
  sessionCompletedBody: "Your session with {takumiName} has been settled. Your invoice is available.",
  paymentFailedTitle: "Payment failed",
  paymentFailedBody: "Your payment for the booking could not be processed. Please check your payment method.",
  walletTopupTitle: "Credit balance topped up",
  walletTopupBody: "{amount} € have been added to your credit balance.",
}

const es: Row = {
  newWaymailTitle: "Nuevo Waymail",
  sessionReminderUserInappTitle: "Recordatorio: tu sesión empieza pronto",
  sessionReminderUserInappBody: "En unos 5 minutos empieza tu sesión con {partnerName}.",
  sessionReminderUserPushTitle: "La sesión empieza en 5 minutos",
  sessionReminderUserPushBody: "Con {partnerName} a las {time}",
  sessionReminderExpertInappTitle: "Recordatorio: la sesión empieza pronto",
  sessionReminderExpertInappBody: "En unos 5 minutos empieza tu sesión con {partnerName}.",
  sessionReminderExpertPushTitle: "La sesión empieza en 5 minutos",
  sessionReminderExpertPushBody: "Con {partnerName} a las {time}",
  partnerWaitingTitle: "Tu cita está en la videollamada",
  partnerWaitingBody: "{name} espera en vuestra videosesión reservada.",
  partnerJoinedTitle: "Tu cita se ha unido",
  partnerJoinedBody: "{name} se ha unido a la videosesión.",
  bookingPaidPushTitle: "Nueva reserva (pagada)",
  bookingPaidPushBody: "{shugyoName} reservó el {date} a las {time}.",
  bookingCancelledTitle: "Reserva cancelada",
  bookingCancelledBody: "Tu reserva del {date} a las {time} fue cancelada por {cancelledByName}.",
  chatWritingTitle: "{sender} te escribe…",
  waymailFromTitle: "Waymail de {sender}",
  instantExpiredPushTitle: "Sin respuesta",
  instantExpiredPushBody: "No hay experto disponible. Se han liberado tus fondos.",
  instantExpiredWaymailSubject: "Sin experto disponible",
  instantExpiredWaymailBody: "No hay experto disponible. Se han liberado tus fondos.",
  bookingRequestUnpaidTitle: "Nueva solicitud de reserva",
  bookingRequestUnpaidBody: "{shugyoName} quiere reservar el {date} ({timeRange}).",
  instantRequestTitle: "Solicitud instantánea",
  instantRequestBody: "{userName} quiere conectar contigo.",
  bookingConfirmedTitle: "Reserva confirmada",
  bookingConfirmedBody: "{takumiName} confirmó tu reserva del {date} ({timeRange}).",
  bookingDeclinedTitle: "Reserva rechazada",
  bookingDeclinedBody: "{takumiName} rechazó tu solicitud de reserva del {date}.",
  bookingQuestionTitle: "Pregunta sobre tu reserva",
  bookingQuestionBody: "{takumiName} hizo una pregunta: {snippet}",
  sessionCompletedTitle: "Sesión completada",
  sessionCompletedBody: "Tu sesión con {takumiName} ha sido liquidada. Tu factura está disponible.",
  paymentFailedTitle: "Pago fallido",
  paymentFailedBody: "Tu pago para la reserva no pudo ser procesado. Por favor verifica tu método de pago.",
  walletTopupTitle: "Saldo recargado",
  walletTopupBody: "Se han añadido {amount} € a tu saldo.",
}

const byLocale: Record<AppLocale, Row> = { de, en, es }

export type PushStringKey = keyof typeof de

export function pushT(locale: AppLocale, key: PushStringKey, vars?: Record<string, string>): string {
  const row = byLocale[locale] ?? de
  const template = row[key] ?? de[key] ?? key
  return vars ? interpolate(template, vars) : template
}
