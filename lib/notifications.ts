// プッシュ通知ユーティリティ

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.warn('このブラウザはプッシュ通知に対応していません')
    return false
  }

  if (Notification.permission === 'granted') {
    return true
  }

  if (Notification.permission === 'denied') {
    return false
  }

  const permission = await Notification.requestPermission()
  return permission === 'granted'
}

export function checkNotificationSupport(): boolean {
  return 'Notification' in window && 'serviceWorker' in navigator
}

export async function showNotification(
  title: string,
  options?: NotificationOptions
): Promise<void> {
  if (!checkNotificationSupport()) {
    return
  }

  if (Notification.permission === 'granted') {
    // Service Worker経由で通知を表示
    const registration = await navigator.serviceWorker.ready
    await registration.showNotification(title, {
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png',
      ...options
    })
  }
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    console.warn('Service Workerに対応していません')
    return null
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js')
    console.log('Service Worker登録成功:', registration)
    return registration
  } catch (error) {
    console.error('Service Worker登録失敗:', error)
    return null
  }
}
