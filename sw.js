const CACHE_NAME = 'fallocero-v2'; // 👈 subí la versión para limpiar el cache anterior

const urlsToCache = [
  '/',
  '/index.html',
  '/login.html',
  '/menu.html',
  '/mapa.html',
  '/mis-reportes.html',
  '/perfil.html',
  '/perfil-admin.html', // ✅ corregido
  '/registro.html',
  '/recuperarPassword.html',
  '/admin/index.html',
  '/admin/mapa-admin.html',
  '/css/style.css',
  '/js/firebase-config.js',
  '/js/login.js',
  '/js/menu.js',
  '/js/mapa.js',
  '/js/mis-reportes.js',
  '/js/perfil.js',
  '/js/recuperar.js',
  '/js/registro.js',
  '/js/reportar.js',
  '/js/admin/mapa-admin.js',
  '/js/admin/perfil-admin.js', // ✅ corregido
  '/js/admin.js',
  '/img/Logo3.png',
  'server.js',
];

// ================================================
// INSTALL — cachear archivos
// ================================================
self.addEventListener('install', event => {
  self.skipWaiting(); // Toma control inmediatamente
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      const promises = urlsToCache.map(url =>
        cache.add(url).catch(err => console.warn('⚠️ No se pudo cachear:', url, err))
      );
      return Promise.all(promises);
    })
  );
});

// ================================================
// ACTIVATE — limpiar caches viejos
// ================================================
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Eliminando cache viejo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => clients.claim()) // Toma control de todas las pestañas
  );
});

// ================================================
// FETCH — red primero, cache como respaldo
// ================================================
self.addEventListener('fetch', event => {
  // Ignorar peticiones que no sean GET
  if (event.request.method !== 'GET') return;

  // Ignorar peticiones de Firebase y externos (no cachear)
  const url = event.request.url;
  if (
    url.includes('firestore.googleapis.com') ||
    url.includes('firebase') ||
    url.includes('gstatic.com') ||
    url.includes('googleapis.com')
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Guardar copia fresca en cache
        if (response && response.status === 200) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // Sin conexión — usar cache
        return caches.match(event.request);
      })
  );
});
// sw.js

// 1. Escuchar el evento Push que envía el servidor
self.addEventListener('push', event => {
  let data = { title: 'Actualización de Anomalías', body: 'Cambio de estado en el sistema.' };

  if (event.data) {
    data = event.data.json();
  }

  const opciones = {
    body: data.body,
    icon: '/img/icon-notificacion.png', // Puedes apuntar a una imagen dentro de tu carpeta img/
    badge: '/img/badge.png',            // Icono pequeño de estado (blanco y negro recomendado)
    vibrate: [200, 100, 200],
    data: {
      url: data.url // Adjuntamos la URL dinámica en los metadatos de la alerta
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, opciones)
  );
});

// Dentro de tu sw.js
self.addEventListener('notificationclick', event => {
  event.notification.close();

  // Forzamos a que abra la URL apuntando al puerto de tu Live Server (5500)
  const urlDestino = `http://127.0.0.1:5500${event.notification.data.url}`;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (let client of windowClients) {
        if (client.url === urlDestino && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlDestino);
      }
    })
  );
});