// js/notificaciones-realtime.js
import { db } from './firebase-config.js';
import { 
    collection, 
    query, 
    where, 
    onSnapshot,
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { mostrarToast } from './utils.js';

// ==========================================
//  GESTOR DE NOTIFICACIONES EN TIEMPO REAL
// ==========================================

class NotificacionesRealtime {
    constructor() {
        this.unsubscribe = null;
        this.usuarioId = null;
        this.lastReportes = {};
        this.permisoNotificaciones = false;
        this.notificacionesPendientes = 0;
        this.onNotificacionCallback = null;
    }

    // ✅ Solicitar permiso de notificaciones
    async solicitarPermiso() {
        if (!("Notification" in window)) {
            console.log("⚠️ Este navegador no soporta notificaciones");
            return false;
        }

        if (Notification.permission === "granted") {
            this.permisoNotificaciones = true;
            return true;
        }

        if (Notification.permission === "denied") {
            console.log("❌ Permiso de notificaciones denegado");
            return false;
        }

        const permission = await Notification.requestPermission();
        this.permisoNotificaciones = permission === "granted";
        return this.permisoNotificaciones;
    }

    // ✅ Mostrar notificación nativa
    mostrarNotificacion(titulo, mensaje, icono = null) {
        // Guardar para el contador
        this.notificacionesPendientes++;
        this.actualizarContador();

        // Notificación nativa
        if (this.permisoNotificaciones) {
            const options = {
                body: mensaje,
                icon: icono || '/img/Logo3.png',
                badge: '/img/Logo3.png',
                vibrate: [200, 100, 200],
                tag: `reporte-${Date.now()}`,
                requireInteraction: true
            };
            
            const notification = new Notification(titulo, options);
            
            // Cerrar automáticamente después de 6 segundos
            setTimeout(() => {
                if (notification.close) notification.close();
            }, 6000);
            
            // Al hacer clic en la notificación
            notification.onclick = () => {
                window.focus();
                notification.close();
                // Redirigir a mis reportes
                window.location.href = 'mis-reportes.html';
            };
        }
        
        // ✅ SIEMPRE mostrar Toast como respaldo
        mostrarToast(`🔔 ${titulo}: ${mensaje}`, 'info');
        
        // Ejecutar callback si existe
        if (this.onNotificacionCallback) {
            this.onNotificacionCallback({
                titulo,
                mensaje,
                icono,
                timestamp: new Date()
            });
        }
    }

    // ✅ Obtener ícono según estado
    obtenerIconoPorEstado(estado) {
        const iconos = {
            'pendiente': '/img/Logo3.png',
            'en revisión': '/img/Logo3.png',
            'en revision': '/img/Logo3.png',
            'resuelto': '/img/Logo3.png',
            'rechazado': '/img/Logo3.png'
        };
        return iconos[estado.toLowerCase()] || '/img/Logo3.png';
    }

    // ✅ Obtener emoji según estado
    obtenerEmojiPorEstado(estado) {
        const emojis = {
            'pendiente': '📋',
            'en revisión': '🔍',
            'en revision': '🔍',
            'resuelto': '✅',
            'rechazado': '❌',
            'completado': '🎉'
        };
        return emojis[estado.toLowerCase()] || '📢';
    }

    // ✅ Formatear título según estado
    formatearTitulo(estado, tipoAnomalia) {
        const titulos = {
            'pendiente': '📋 Reporte Pendiente',
            'en revisión': '🔍 Reporte en Revisión',
            'en revision': '🔍 Reporte en Revisión',
            'resuelto': '✅ ¡Reporte Resuelto!',
            'rechazado': '❌ Reporte Rechazado'
        };
        return titulos[estado.toLowerCase()] || `📢 ${tipoAnomalia || 'Reporte'}`;
    }

    // ✅ Actualizar contador en la UI
    actualizarContador() {
        const contador = document.getElementById('notificaciones-contador');
        if (contador) {
            if (this.notificacionesPendientes > 0) {
                contador.textContent = this.notificacionesPendientes;
                contador.style.display = 'flex';
                // Animación de rebote
                contador.style.animation = 'none';
                setTimeout(() => {
                    contador.style.animation = 'bounce 0.5s ease';
                }, 10);
            } else {
                contador.style.display = 'none';
            }
        }
    }

    // ✅ Marcar notificaciones como leídas
    marcarComoLeidas() {
        this.notificacionesPendientes = 0;
        this.actualizarContador();
    }

    // ✅ Iniciar escucha de reportes
    iniciarEscucha(usuarioId, callback = null) {
        if (!usuarioId) {
            console.error('❌ Se requiere usuarioId para escuchar reportes');
            return false;
        }

        // Guardar callback
        if (callback) {
            this.onNotificacionCallback = callback;
        }

        // Detener escucha anterior si existe
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }

        this.usuarioId = usuarioId;
        console.log(`🔵 Iniciando escucha de reportes para: ${usuarioId}`);

        // Crear consulta: reportes del usuario actual
        const reportesRef = collection(db, "reportes");
        const q = query(
            reportesRef,
            where("idUsuario", "==", usuarioId)
        );

        // Iniciar snapshot en tiempo real
        this.unsubscribe = onSnapshot(q, (snapshot) => {
            const cambios = [];
            
            snapshot.docChanges().forEach((change) => {
                const data = change.doc.data();
                const docId = change.doc.id;
                
                // Guardar estado anterior
                const estadoAnterior = this.lastReportes[docId];
                const estadoActual = data.estado || 'pendiente';
                
                // Detectar cambios de estado (solo en modificaciones)
                if (change.type === "modified") {
                    if (estadoAnterior && estadoAnterior.estado !== estadoActual) {
                        cambios.push({
                            id: docId,
                            titulo: data.tipoAnomalia || 'Reporte',
                            descripcion: data.descripcion || '',
                            estadoAnterior: estadoAnterior.estado,
                            estadoNuevo: estadoActual,
                            data: data
                        });
                    }
                }
                
                // Actualizar registro con datos actuales
                this.lastReportes[docId] = {
                    estado: estadoActual,
                    titulo: data.tipoAnomalia,
                    descripcion: data.descripcion,
                    fecha: data.fechaCreacion
                };
            });
            
            // Procesar cambios detectados
            if (cambios.length > 0) {
                cambios.forEach((cambio) => {
                    const emoji = this.obtenerEmojiPorEstado(cambio.estadoNuevo);
                    const titulo = this.formatearTitulo(cambio.estadoNuevo, cambio.titulo);
                    const mensaje = `${emoji} ${cambio.titulo}: ${cambio.estadoAnterior} → ${cambio.estadoNuevo}`;
                    
                    this.mostrarNotificacion(
                        titulo,
                        mensaje,
                        this.obtenerIconoPorEstado(cambio.estadoNuevo)
                    );
                    
                    // Log en consola
                    console.log(`📢 Notificación: ${titulo} - ${mensaje}`);
                });
            }
            
        }, (error) => {
            console.error("❌ Error en onSnapshot:", error);
            mostrarToast('Error al cargar reportes en tiempo real', 'error');
        });

        return true;
    }

    // ✅ Detener escucha
    detenerEscucha() {
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
            console.log("🛑 Escucha de reportes detenida");
        }
        this.usuarioId = null;
    }

    // ✅ Verificar si está escuchando
    estaEscuchando() {
        return this.unsubscribe !== null;
    }

    // ✅ Obtener estadísticas
    getEstadisticas() {
        const total = Object.keys(this.lastReportes).length;
        const pendientes = Object.values(this.lastReportes).filter(r => r.estado === 'pendiente').length;
        const enRevision = Object.values(this.lastReportes).filter(r => r.estado === 'en revisión' || r.estado === 'en revision').length;
        const resueltos = Object.values(this.lastReportes).filter(r => r.estado === 'resuelto').length;
        
        return {
            total,
            pendientes,
            enRevision,
            resueltos
        };
    }
}

// ==========================================
//  INSTANCIA ÚNICA (Singleton)
// ==========================================
const notificacionesRealtime = new NotificacionesRealtime();

// ==========================================
//  INYECTAR ESTILOS DEL CONTADOR
// ==========================================
function injectStyles() {
    const styles = document.createElement('style');
    styles.textContent = `
        /* Contador de notificaciones */
        #notificaciones-contador {
            position: absolute;
            top: -5px;
            right: -5px;
            background: #ef4444;
            color: white;
            border-radius: 50%;
            padding: 2px 6px;
            font-size: 10px;
            font-weight: bold;
            min-width: 18px;
            height: 18px;
            display: none;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 4px rgba(239, 68, 68, 0.4);
            border: 2px solid white;
            z-index: 10;
            line-height: 1;
        }

        @keyframes bounce {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.3); }
        }

        /* Badge de estado en tarjetas */
        .estado-badge {
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            display: inline-block;
        }
        .estado-pendiente {
            background: #fef3c7;
            color: #92400e;
        }
        .estado-en-revision {
            background: #dbeafe;
            color: #1e40af;
        }
        .estado-resuelto {
            background: #d1fae5;
            color: #065f46;
        }
        .estado-rechazado {
            background: #fee2e2;
            color: #991b1b;
        }
    `;
    document.head.appendChild(styles);
}

// Inyectar estilos automáticamente
injectStyles();

export default notificacionesRealtime;