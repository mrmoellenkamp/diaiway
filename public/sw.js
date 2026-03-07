/**
 * Service Worker für Web Push Notifications.
 * Wird bei /sw.js geladen.
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
  const options = {
    body,
    icon: "/icon.svg",
    badge: "/icon.svg",
    tag: data.tag || "diaiway-notification",
    data: { url },
    requireInteraction: false,
    vibrate: [200, 100, 200],
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const url = event.notification.data?.url || "/messages"
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
