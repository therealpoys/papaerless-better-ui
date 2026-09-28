self.addEventListener("push", (event) => {
  let payload = { title: "Paperless Better UI", body: "Neue Benachrichtigung" };
  try {
    payload = event.data.json();
  } catch {
    // kein JSON-Payload – Standardtext verwenden
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      data: payload.data ?? {},
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow("/"));
});
