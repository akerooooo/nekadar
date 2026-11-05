// Servis iscisine eklenir (vite.config.ts importScripts). FCM'den gelen bildirimi gosterir.
// iOS her push'ta bildirim gosterilmesini ister; bos gelse de bir sey gosterilir.
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { data: { body: event.data && event.data.text() } };
  }
  const n = payload.notification || payload.data || {};
  event.waitUntil(
    self.registration.showNotification(n.title || 'Nekadar', {
      body: n.body || '',
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png',
      tag: n.tag,
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) =>
      wins.length ? wins[0].focus() : self.clients.openWindow(self.registration.scope),
    ),
  );
});
