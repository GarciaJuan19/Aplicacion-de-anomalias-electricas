// notificaciones.js - Módulo para manejar notificaciones push
class NotificationManager {
    constructor() {
        this.swRegistration = null;
        this.isSupported = 'serviceWorker' in navigator && 'PushManager' in window;
        // ✅ TU VAPID KEY DE FIREBASE
        this.vapidPublicKey = 'BC38z-dXAW0Z2wpKFZabFUXHKsBLqqQgySRJLlaaqGw9cbxZl6ojAXX5_f6AsTv2hXXfV5OjkQLzgPgrggOz5k';
    }

    // Inicializar el manager
    async init() {
        if (!this.isSupported) {
            console.warn('⚠️ Notificaciones push no soportadas');
            return false;
        }

        try {
            // Registrar Service Worker
            this.swRegistration = await this.registrarServiceWorker();
            if (!this.swRegistration) {
                return false;
            }

            // Solicitar permiso
            const permiso = await this.solicitarPermiso();
            if (!permiso) {
                console.warn('⚠️ Permiso de notificaciones denegado');
                return false;
            }

            // Suscribirse a push
            const subscription = await this.suscribirsePush();
            if (subscription) {
                console.log('✅ Notificaciones configuradas correctamente');
                console.log('📨 Suscripción:', subscription);
                return true;
            }

            return false;
        } catch (error) {
            console.error('❌ Error inicializando notificaciones:', error);
            return false;
        }
    }

    // Registrar Service Worker
    async registrarServiceWorker() {
        try {
            if (!('serviceWorker' in navigator)) {
                console.warn('⚠️ Service Workers no soportados');
                return null;
            }

            // Verificar si ya está registrado
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (let reg of registrations) {
                if (reg.active && reg.active.scriptURL.includes('sw.js')) {
                    console.log('✅ Service Worker ya registrado');
                    return reg;
                }
            }

            // Registrar nuevo
            const registration = await navigator.serviceWorker.register('/sw.js', {
                scope: '/'
            });
            
            console.log('✅ Service Worker registrado');
            return registration;
        } catch (error) {
            console.error('❌ Error registrando SW:', error);
            return null;
        }
    }

    // Solicitar permiso de notificaciones
    async solicitarPermiso() {
        try {
            if (!('Notification' in window)) {
                console.warn('⚠️ Notifications no soportadas');
                return false;
            }

            // Si ya tiene permiso
            if (Notification.permission === 'granted') {
                console.log('✅ Permiso ya concedido');
                return true;
            }

            // Si está denegado
            if (Notification.permission === 'denied') {
                console.warn('⚠️ Permiso denegado permanentemente');
                return false;
            }

            // Solicitar permiso
            const permission = await Notification.requestPermission();
            console.log('📢 Permiso de notificación:', permission);
            
            return permission === 'granted';
        } catch (error) {
            console.error('❌ Error solicitando permiso:', error);
            return false;
        }
    }

    // Suscribirse a push con tu VAPID Key
    async suscribirsePush() {
        try {
            if (!this.swRegistration) {
                console.warn('⚠️ SW no registrado');
                return null;
            }

            // Verificar si ya está suscrito
            const existingSubscription = await this.swRegistration.pushManager.getSubscription();
            if (existingSubscription) {
                console.log('✅ Ya estás suscrito');
                return existingSubscription;
            }

            // ✅ USAR TU VAPID KEY DE FIREBASE
            console.log('🔑 Usando VAPID Key de Firebase');
            const applicationServerKey = this.urlBase64ToUint8Array(this.vapidPublicKey);

            // Suscribirse
            const subscription = await this.swRegistration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: applicationServerKey
            });

            console.log('✅ Suscripción push exitosa');
            console.log('📨 Endpoint:', subscription.endpoint);
            return subscription;
        } catch (error) {
            console.error('❌ Error suscribiendo a push:', error);
            
            // Si el error es por la VAPID key, mostrar mensaje claro
            if (error.message && error.message.includes('InvalidAccessError')) {
                console.error('⚠️ La VAPID Key podría ser inválida. Verifica que sea correcta.');
            }
            return null;
        }
    }

    // Convertir VAPID Key a Uint8Array
    urlBase64ToUint8Array(base64String) {
        try {
            console.log('🔄 Convirtiendo VAPID Key...');
            const padding = '='.repeat((4 - base64String.length % 4) % 4);
            const base64 = (base64String + padding)
                .replace(/\-/g, '+')
                .replace(/_/g, '/');

            const rawData = window.atob(base64);
            const outputArray = new Uint8Array(rawData.length);

            for (let i = 0; i < rawData.length; ++i) {
                outputArray[i] = rawData.charCodeAt(i);
            }
            console.log('✅ VAPID Key convertida correctamente');
            return outputArray;
        } catch (error) {
            console.error('❌ Error convirtiendo VAPID key:', error);
            return new Uint8Array(0);
        }
    }

    // Enviar notificación de prueba
    async enviarNotificacionPrueba() {
        try {
            if (!this.swRegistration) {
                console.warn('⚠️ SW no registrado');
                return false;
            }

            const options = {
                body: '🎉 ¡Las notificaciones están funcionando!',
                icon: '/img/Logo3.png',
                badge: '/img/Logo3.png',
                vibrate: [200, 100, 200],
                tag: 'notificacion-prueba',
                requireInteraction: true,
                data: {
                    url: '/admin.html'
                }
            };

            await this.swRegistration.showNotification('📢 FalloCero - Prueba', options);
            console.log('✅ Notificación de prueba enviada');
            return true;
        } catch (error) {
            console.error('❌ Error enviando notificación de prueba:', error);
            return false;
        }
    }

    // Desuscribirse
    async desuscribir() {
        try {
            if (this.swRegistration) {
                const subscription = await this.swRegistration.pushManager.getSubscription();
                if (subscription) {
                    await subscription.unsubscribe();
                    console.log('✅ Desuscripción exitosa');
                    return true;
                }
            }
            return false;
        } catch (error) {
            console.error('❌ Error desuscribiendo:', error);
            return false;
        }
    }

    // Verificar estado de la suscripción
    async verificarSuscripcion() {
        try {
            if (!this.swRegistration) {
                return false;
            }
            const subscription = await this.swRegistration.pushManager.getSubscription();
            return !!subscription;
        } catch (error) {
            console.error('❌ Error verificando suscripción:', error);
            return false;
        }
    }

    // ✅ NUEVO: Obtener la suscripción actual
    async obtenerSuscripcion() {
        try {
            if (!this.swRegistration) {
                return null;
            }
            return await this.swRegistration.pushManager.getSubscription();
        } catch (error) {
            console.error('❌ Error obteniendo suscripción:', error);
            return null;
        }
    }
}

// Crear instancia global
const notificationManager = new NotificationManager();

// Exponerla globalmente para usarla desde consola
window.notificationManager = notificationManager;

// Exportar para usar en módulos
export default notificationManager;