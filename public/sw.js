self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title || "Bayres Servicios", {
      body: data.body || "",
      icon: "/sol-de-mayo.png",
      badge: "/sol-de-mayo.png",
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow("/gestion"));
});