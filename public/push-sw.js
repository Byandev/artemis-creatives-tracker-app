// Web Push for the installed web app. Workbox's generated sw.js pulls this in (see
// workbox-config.js `importScripts`). Payloads come from Artemis' WebPushSender:
// { title, body, data: { type, ... }, url }.

self.addEventListener('push', (event) => {
  let message = {};
  try {
    message = event.data ? event.data.json() : {};
  } catch {
    message = { body: event.data ? event.data.text() : '' };
  }

  event.waitUntil(
    self.registration.showNotification(message.title || 'Artemis', {
      body: message.body || '',
      icon: '/logo192.png',
      badge: '/logo192.png',
      // One notification per creative, and today's reminder replaces yesterday's instead of stacking.
      tag: message.data?.creative_id ? `creative-${message.data.creative_id}` : message.data?.type || 'artemis',
      renotify: true,
      data: { url: message.url || '/', ...message.data },
    }),
  );
});

// Tapping opens the Creatives list: in the app window if one is open, otherwise a new one.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href;

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const existing = windows.find((client) => new URL(client.url).origin === self.location.origin);
      if (existing) {
        await existing.focus();
        if (existing.url !== url && 'navigate' in existing) await existing.navigate(url).catch(() => {});
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});
