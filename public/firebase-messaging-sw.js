// Firebase Cloud Messaging (FCM) Dedicated Service Worker
// Handles background push notifications, Android wakeups, and notification clicks for Espacios Comunitarios

/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/12.18.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.18.0/firebase-messaging-compat.js');

// Firebase Configuration
const firebaseConfig = {
  projectId: "gen-lang-client-0872256224",
  appId: "1:429338046424:web:66884a718f85cbd219ccad",
  apiKey: "AIzaSyDUiIyAjV-mx-G48RB4oPCDkxWiPQjSrPs",
  authDomain: "gen-lang-client-0872256224.firebaseapp.com",
  messagingSenderId: "429338046424"
};

// Initialize Firebase App in Service Worker context
try {
  firebase.initializeApp(firebaseConfig);
} catch (e) {
  console.debug('Firebase SW initialization notice:', e);
}

let messaging = null;
try {
  messaging = firebase.messaging();
} catch (e) {
  console.debug('Firebase Messaging SW notice:', e);
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// 1. Firebase Cloud Messaging onBackgroundMessage handler
if (messaging) {
  messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background FCM message:', payload);

    const notificationTitle = payload.notification?.title || payload.data?.title || '⭐ Actividad Importante - Espacios Comunitarios';
    const notificationBody = payload.notification?.body || payload.data?.body || 'Se ha registrado una actividad prioritaria.';
    const notifType = payload.data?.type || 'important';
    const reservationId = payload.data?.reservationId || '';
    const view = payload.data?.view || 'calendar';

    const notificationOptions = {
      body: notificationBody,
      icon: '/icon-192.png',
      badge: '/badge-72.png',
      tag: `fcm-${notifType}-${reservationId || Date.now()}`,
      data: {
        url: '/',
        view: view,
        reservationId: reservationId,
        type: notifType,
        ...payload.data
      },
      vibrate: notifType === 'conflict' ? [250, 100, 250, 100, 300] : [150, 80, 250],
      renotify: true,
      requireInteraction: notifType === 'important' || notifType === 'conflict',
      actions: [
        { action: 'view_app', title: 'Abrir Aplicación' },
        { action: 'view_calendar', title: 'Ver Calendario' }
      ]
    };

    return self.registration.showNotification(notificationTitle, notificationOptions);
  });
}

// 2. Direct Web Push Event Listener (Fallback / Android Web Push)
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const rawText = event.data.text();
    let data;
    try {
      data = event.data.json();
    } catch {
      data = { body: rawText };
    }

    // Check if message was already handled by onBackgroundMessage
    if (data.notification || data.data) {
      const notif = data.notification || {};
      const customData = data.data || {};
      const title = notif.title || customData.title || '⭐ Notificación de Espacios';
      const body = notif.body || customData.body || 'Nueva actualización en el sistema.';
      const type = customData.type || 'important';

      const options = {
        body: body,
        icon: '/icon-192.png',
        badge: '/badge-72.png',
        tag: `fcm-push-${type}-${customData.reservationId || Date.now()}`,
        data: {
          url: '/',
          view: customData.view || 'calendar',
          reservationId: customData.reservationId || '',
          ...customData
        },
        vibrate: type === 'conflict' ? [200, 100, 200, 100, 300] : [150, 80, 250],
        renotify: true,
        requireInteraction: true,
        actions: [
          { action: 'view_app', title: 'Ver en App' }
        ]
      };

      event.waitUntil(self.registration.showNotification(title, options));
    }
  } catch (err) {
    console.warn('[firebase-messaging-sw.js] Error handling push event:', err);
  }
});

// 3. Notification Click Handler (Mobile Android tap & Desktop click)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';
  const targetView = event.notification.data?.view || 'calendar';
  const reservationId = event.notification.data?.reservationId || '';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it and post a message to navigate
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          client.postMessage({
            type: 'NAVIGATE_VIEW',
            view: targetView,
            reservationId: reservationId
          });
          return;
        }
      }
      // If no window is open, open a new browser window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
