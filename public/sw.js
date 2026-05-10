self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title || "Bayres Servicios", {
      body: data.body || "",
      icon: "/sol-de-mayo.png",
      badge: "/sol-de-mayo.png",
      data: { url: "/gestion?tab=materiales" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/gestion";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes("/gestion") && "focus" in client) {
          client.focus();
          return;
        }
      }
      return clients.openWindow(url);
    })
  );
});