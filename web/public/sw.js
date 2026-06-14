self.addEventListener('push', (e) => {
  const data = e.data?.json() ?? { title: 'Shopping Assistant', body: 'Nouveau résultat' };
  self.registration.showNotification(data.title, {
    body: data.body,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
  });
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(clients.openWindow('/search'));
});