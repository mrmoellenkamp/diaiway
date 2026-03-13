/**
 * Service Worker für Web Push Notifications.
 * Quick Actions für Instant Connect (BOOKING_REQUEST).
 */
self.addEventListener("push", (event) => {
  if (!event.data) return
  let data
  try {
    data = event.data.json()
  } catch {
    data = { title: "diAiway", body: event.data.text() || "Neue Benachrichtigung" }
  }
  const title = data.title || "diAiway"
  const body = data.body || "Neue Nachricht"
  const url = data.url || "/messages"
  const pushData = data.data || {}
  const options = {
    body,
    icon: "/icons/camera-switch.svg",
    badge: "/icons/camera-switch.svg",
    tag: data.tag || "diaiway-notification",
    data: { url, ...pushData },
    requireInteraction: pushData.type === "BOOKING_REQUEST",
    vibrate: [200, 100, 200],
    actions: pushData.type === "BOOKING_REQUEST" && pushData.bookingId && pushData.statusToken
      ? [
          { action: "DECLINE", title: "Ablehnen" },
          { action: "ACCEPT", title: "Annehmen" },
        ]
      : [],
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const d = event.notification.data || {}
  const action = event.action || ""
  let url = d.url || "/messages"

  if (d.type === "BOOKING_REQUEST" && d.bookingId && d.statusToken) {
    if (action === "ACCEPT") {
      url = `${self.location.origin}/api/bookings/${d.bookingId}/instant-accept?token=${encodeURIComponent(d.statusToken)}`
    } else if (action === "DECLINE") {
      url = `${self.location.origin}/api/bookings/${d.bookingId}/instant-decline?token=${encodeURIComponent(d.statusToken)}`
    } else {
      url = `${self.location.origin}/session/${d.bookingId}`
    }
  }

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})
