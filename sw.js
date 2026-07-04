// sw.js - Service Worker para notificaciones PWA
const CACHE_NAME = 'fallocero-v1';

// Instalación
self.addEventListener('install', (event) => {
    console.log('✅ Service Worker instalado');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('📦 Cache abierto');
                return cache.add('/');
            })
            .then(() => {
                return self.skipWaiting();
            })
            .catch(err => {
                console.warn('⚠️ Error en instalación:', err);
            })
    );
});

// Activación
self.addEventListener('activate', (event) => {
    console.log('✅ Service Worker activado');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('🗑️ Eliminando cache antiguo:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
        .then(() => {
            return self.clients.claim();
        })
    );
});

// Fetch - Estrategia simple
self.addEventListener('fetch', (event) => {
    event.respondWith(
        fetch(event.request)
            .catch(() => {
                return caches.match(event.request);
            })
    );
});

// 📨 MANEJAR NOTIFICACIONES PUSH
self.addEventListener('push', (event) => {
    console.log('📨 Push recibido:', event);
    
    let titulo = '📢 FalloCero';
    let mensaje = 'Tu reporte ha sido actualizado';
    let icon = '/img/Logo3.png';
    let badge = '/img/Logo3.png';
    let reporteId = null;

    if (event.data) {
        try {
            const data = event.data.json();
            titulo = data.title || titulo;
            mensaje = data.body || mensaje;
            icon = data.icon || icon;
            badge = data.badge || badge;
            reporteId = data.reporteId || null;
            console.log('📨 Datos de notificación:', data);
        } catch (e) {
            try {
                mensaje = event.data.text();
                console.log('📨 Mensaje texto:', mensaje);
            } catch (err) {
                console.warn('⚠️ No se pudo leer el mensaje');
            }
        }
    }

    const options = {
        body: mensaje,
        icon: icon,
        badge: badge,
        tag: `reporte-${reporteId || 'general'}`,
        data: {
            reporteId: reporteId
        },
        vibrate: [200, 100, 200],
        requireInteraction: true,
        actions: [
            {
                action: 'ver',
                title: '👁️ Ver reporte'
            },
            {
                action: 'cerrar',
                title: '❌ Cerrar'
            }
        ]
    };

    event.waitUntil(
        self.registration.showNotification(titulo, options)
    );
});

// 📌 MANEJAR CLIC EN NOTIFICACIÓN
self.addEventListener('notificationclick', (event) => {
    console.log('🔔 Click en notificación:', event);
    
    event.notification.close();

    const action = event.action;
    const reporteId = event.notification.data?.reporteId;

    let targetUrl = '/admin.html';
    if (reporteId) {
        targetUrl = `/detalle.html?id=${reporteId}`;
    }

    if (action === 'ver' || !action || action === '') {
        event.waitUntil(
            clients.matchAll({
                type: 'window',
                includeUncontrolled: true
            }).then((clientList) => {
                for (let i = 0; i < clientList.length; i++) {
                    const client = clientList[i];
                    if (client.url.includes(targetUrl) && 'focus' in client) {
                        return client.focus();
                    }
                }
                if (clients.openWindow) {
                    return clients.openWindow(targetUrl);
                }
            })
        );
    }
});