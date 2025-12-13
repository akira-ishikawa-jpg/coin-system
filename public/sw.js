// Service Worker for push notifications

self.addEventListener('install', (event) => {
  console.log('Service Worker: Installed')
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activated')
  event.waitUntil(self.clients.claim())
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // 既に開いているタブがあればフォーカス
      for (const client of clientList) {
        if (client.url.includes('/thanks') && 'focus' in client) {
          return client.focus()
        }
      }
      
      // なければ新しいタブを開く
      if (self.clients.openWindow) {
        return self.clients.openWindow('/thanks')
      }
    })
  )
})

self.addEventListener('push', (event) => {
  if (!event.data) {
    return
  }

  const data = event.data.json()
  const title = data.title || 'コインシステム'
  const options = {
    body: data.body || '',
    icon: data.icon || '/icon-192x192.png',
    badge: '/badge-72x72.png',
    tag: data.tag || 'coin-notification',
    data: data.data || {}
  }

  event.waitUntil(
    self.registration.showNotification(title, options)
  )
})
