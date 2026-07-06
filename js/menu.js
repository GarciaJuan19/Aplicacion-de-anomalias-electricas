import { auth, db } from './firebase-config.js';
import { 
    onAuthStateChanged, 
    signOut, 
    sendEmailVerification,
    applyActionCode
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
    doc,
    getDoc,
    collection,
    query,
    where,
    orderBy,
    limit,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getMenuUrl, mostrarToast } from './utils.js';
import notificacionesRealtime from './notificaciones-realtime.js';

const txtDisplayName = document.getElementById('user-display-name');
const menuProfilePreview = document.getElementById('menu-profile-preview');
const menuAvatarIcon = document.getElementById('menu-avatar-icon');

// ==========================================
//  REFERENCIAS DEL DOM PARA NOTIFICACIONES
// ==========================================
const btnNotificaciones = document.getElementById('btn-notificaciones');
const iconoCampana = document.getElementById('icono-campana');
const badgeNotificaciones = document.getElementById('badge-notificaciones');
const modalNotif = document.getElementById('modal-notificaciones');
const modalCuerpo = document.getElementById('modal-notificaciones-cuerpo');
const btnCerrarModalNotif = document.getElementById('btn-cerrar-modal-notif');
const btnMarcarVisto = document.getElementById('btn-marcar-visto');
const modalTotalNotif = document.getElementById('modal-total-notif');

// ==========================================
//  ESTADO DE NOTIFICACIONES
// ==========================================
let notificacionesSilenciadas = localStorage.getItem('notificaciones_silenciadas') === 'true';
let alertasPendientesLocales = [];
let notificacionesVistas = new Set();

// ==========================================
//  VARIABLE PARA CONTROLAR REDIRECCIONES
// ==========================================
let redirigiendo = false;

// ==========================================
//  FUNCIÓN: PROCESAR VERIFICACIÓN DESDE LA URL
// ==========================================
async function procesarVerificacion() {
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');
    const oobCode = urlParams.get('oobCode');

    if (mode === 'verifyEmail' && oobCode) {
        try {
            console.log("🔵 Procesando verificación de correo...");
            await applyActionCode(auth, oobCode);
            console.log("✅ Correo verificado correctamente");
            
            window.history.replaceState({}, document.title, window.location.pathname);
            mostrarToast('✅ ¡Correo verificado con éxito!', 'exito');
            return true;
        } catch (error) {
            console.error("❌ Error al verificar:", error);
            mostrarToast('❌ Error al verificar el correo: ' + error.message, 'error');
            return false;
        }
    }
    return false;
}

// ==========================================
//  FUNCIÓN: MOSTRAR ALERTA DE VERIFICACIÓN
// ==========================================
function mostrarAlertaVerificacion() {
    const existingAlert = document.querySelector('.alert-verificacion');
    if (existingAlert) return;

    const alerta = document.createElement('div');
    alerta.className = 'alert-verificacion';
    alerta.style.cssText = `
        background: #fef3c7;
        border: 1px solid #f59e0b;
        border-radius: 12px;
        padding: 12px 16px;
        margin: 16px 24px 0 24px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        font-size: 13px;
        color: #92400e;
        box-shadow: 0 2px 8px rgba(245, 158, 11, 0.15);
    `;
    alerta.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <i class='bx bx-info-circle' style="font-size: 20px; color: #d97706;"></i>
            <span><strong>Verifica tu correo</strong> para acceder a todas las funciones.</span>
        </div>
        <button id="btn-reenviar-verde-menu" style="
            background: #d97706;
            color: white;
            border: none;
            padding: 6px 14px;
            border-radius: 8px;
            font-weight: 600;
            font-size: 12px;
            cursor: pointer;
            white-space: nowrap;
        ">
            Reenviar
        </button>
    `;

    const menuContent = document.querySelector('.menu-content');
    if (menuContent) {
        menuContent.insertBefore(alerta, menuContent.firstChild);
    }

    document.getElementById('btn-reenviar-verde-menu').addEventListener('click', async () => {
        try {
            const user = auth.currentUser;
            if (user) {
                await sendEmailVerification(user, {
                    url: getMenuUrl(),
                    handleCodeInApp: false
                });
                mostrarToast('✅ ¡Correo de verificación reenviado! Revisa tu bandeja de entrada.', 'exito');
            }
        } catch (error) {
            console.error('Error al reenviar:', error);
            mostrarToast('❌ Error al reenviar el correo.', 'error');
        }
    });
}

// ==========================================
//  FUNCIÓN: MOSTRAR FOTO DE PERFIL
// ==========================================
function mostrarAvatar(fotoUrl) {
    if (!menuProfilePreview || !menuAvatarIcon) return;

    if (fotoUrl && fotoUrl.trim() !== "") {
        menuProfilePreview.src = fotoUrl;
        menuProfilePreview.style.display = 'block';
        menuAvatarIcon.style.display = 'none';
    } else {
        menuProfilePreview.style.display = 'none';
        menuAvatarIcon.style.display = 'flex';
    }
}

// ==========================================
//  FUNCIÓN: CARGAR DATOS DEL USUARIO
// ==========================================
async function cargarDatosUsuario(user) {
    try {
        const userDocRef = doc(db, "usuarios", user.uid);
        const docSnap = await getDoc(userDocRef);

        if (docSnap.exists()) {
            const userData = docSnap.data();
            const nombreUsuario = userData.nombre || userData.nombre_completo || "Ciudadano";
            txtDisplayName.innerText = nombreUsuario;
            mostrarAvatar(userData.fotoUrl);
        } else {
            txtDisplayName.innerText = "Ciudadano";
            mostrarAvatar(null);
        }
    } catch (error) {
        console.error("Error al recuperar los datos del usuario:", error);
        txtDisplayName.innerText = "Ciudadano";
        mostrarAvatar(null);
    }
}

// ==========================================
//  FUNCIÓN: RENDERIZAR MODAL DE NOTIFICACIONES
// ==========================================
function renderizarModalNotificaciones() {
    if (!modalCuerpo) return;
    
    // Actualizar contador del modal
    if (modalTotalNotif) {
        modalTotalNotif.textContent = alertasPendientesLocales.length;
    }
    
    // Si no hay notificaciones pendientes
    if (alertasPendientesLocales.length === 0) {
        modalCuerpo.innerHTML = `
            <div class="modal-empty-state">
                <i class='bx bx-check-circle'></i>
                <p>No hay notificaciones nuevas</p>
                <span>Todos tus reportes están al día</span>
            </div>
        `;
        // Ocultar botón "Marcar como visto"
        if (btnMarcarVisto) {
            btnMarcarVisto.style.display = 'none';
        }
        return;
    }

    // Mostrar botón "Marcar como visto"
    if (btnMarcarVisto) {
        btnMarcarVisto.style.display = 'flex';
    }

    // Renderizar lista de notificaciones
    let htmlContent = `<div class="notificaciones-lista">`;
    
    // Mostrar las últimas 20 notificaciones (más recientes primero)
    const notificacionesMostrar = [...alertasPendientesLocales].reverse().slice(0, 20);
    
    notificacionesMostrar.forEach((item) => {
        const folio = item.folio || item.id || 'Reporte';
        const nuevoEstado = item.estado || 'Actualizado';
        const titulo = item.titulo || 'Reporte';
        
        // Obtener emoji y color según estado
        const estadoInfo = {
            'pendiente': { emoji: '📋', color: 'var(--estado-pendiente)' },
            'en revisión': { emoji: '🔍', color: 'var(--estado-revision)' },
            'en revision': { emoji: '🔍', color: 'var(--estado-revision)' },
            'resuelto': { emoji: '✅', color: 'var(--estado-resuelto)' },
            'rechazado': { emoji: '❌', color: 'var(--estado-rechazado)' }
        };
        const info = estadoInfo[nuevoEstado.toLowerCase()] || { emoji: '📢', color: 'var(--text-secondary)' };

        htmlContent += `
            <div class="notificacion-item" style="border-left-color: ${info.color};">
                <div class="notificacion-item-content">
                    <div class="notificacion-item-header">
                        <p class="notificacion-item-titulo">${info.emoji} ${titulo}</p>
                        <span class="notificacion-item-estado" style="background: ${info.color}20; color: ${info.color}; border: 1px solid ${info.color}40;">
                            ${nuevoEstado.toUpperCase()}
                        </span>
                    </div>
                    <p class="notificacion-item-folio">Folio: <span>${folio}</span></p>
                    <p class="notificacion-item-fecha">
                        <i class='bx bx-time'></i> 
                        ${new Date(item.timestamp || Date.now()).toLocaleString('es-MX', { 
                            day: '2-digit', 
                            month: 'short', 
                            hour: '2-digit', 
                            minute: '2-digit' 
                        })}
                    </p>
                </div>
            </div>
        `;
    });
    
    htmlContent += `</div>`;
    modalCuerpo.innerHTML = htmlContent;
}

// ==========================================
//  FUNCIÓN: ACTUALIZAR BADGE DE NOTIFICACIONES
// ==========================================
function actualizarBadgeNotificaciones() {
    if (!badgeNotificaciones) return;
    
    const total = alertasPendientesLocales.length;
    
    if (total > 0) {
        badgeNotificaciones.textContent = total > 99 ? '99+' : total;
        badgeNotificaciones.classList.add('visible');
        badgeNotificaciones.style.animation = 'none';
        setTimeout(() => {
            badgeNotificaciones.style.animation = 'bounce 0.5s ease';
        }, 10);
    } else {
        badgeNotificaciones.classList.remove('visible');
        badgeNotificaciones.textContent = '';
    }
    
    // Actualizar icono de campana
    if (iconoCampana) {
        if (total > 0) {
            iconoCampana.className = 'bx bxs-bell-ring';
        } else if (notificacionesSilenciadas) {
            iconoCampana.className = 'bx bxs-bell-off';
        } else {
            iconoCampana.className = 'bx bx-bell';
        }
    }
}

// ==========================================
//  FUNCIÓN: MARCAR COMO VISTO
// ==========================================
function marcarComoVisto() {
    if (alertasPendientesLocales.length === 0) return;
    
    const total = alertasPendientesLocales.length;
    alertasPendientesLocales = [];
    notificacionesVistas.clear();
    actualizarBadgeNotificaciones();
    renderizarModalNotificaciones();
    
    mostrarToast(`✅ ${total} notificación${total > 1 ? 'es' : ''} marcada${total > 1 ? 's' : ''} como vista${total > 1 ? 's' : ''}`, 'exito');
    
    // Cerrar modal después de un momento
    setTimeout(() => {
        cerrarModalNotificaciones();
    }, 800);
}

// ==========================================
//  FUNCIÓN: TOGGLE SILENCIO
// ==========================================
function toggleSilencio() {
    notificacionesSilenciadas = !notificacionesSilenciadas;
    localStorage.setItem('notificaciones_silenciadas', notificacionesSilenciadas);
    
    actualizarBadgeNotificaciones();
    
    const mensaje = notificacionesSilenciadas 
        ? '🔕 Notificaciones silenciadas' 
        : '🔔 Notificaciones activadas';
    mostrarToast(mensaje, 'info');
}

// ==========================================
//  FUNCIÓN: CERRAR MODAL
// ==========================================
function cerrarModalNotificaciones() {
    if (modalNotif) {
        modalNotif.classList.remove('visible');
        document.body.style.overflow = '';
    }
}

// ==========================================
//  FUNCIÓN: ABRIR MODAL
// ==========================================
function abrirModalNotificaciones() {
    renderizarModalNotificaciones();
    if (modalNotif) {
        modalNotif.classList.add('visible');
        document.body.style.overflow = 'hidden';
    }
}

// ==========================================
//  FUNCIÓN: INICIAR NOTIFICACIONES
// ==========================================
async function iniciarNotificaciones(user) {
    try {
        console.log("🔔 Iniciando sistema inteligente de notificaciones...");
        
        // Configurar estado inicial
        actualizarBadgeNotificaciones();
        
        // ==========================================
        //  EVENTO: CLICK EN BOTÓN DE NOTIFICACIONES
        // ==========================================
        if (btnNotificaciones) {
            btnNotificaciones.addEventListener('click', () => {
                const totalNotificaciones = alertasPendientesLocales.length;
                
                // CASO 1: Hay notificaciones pendientes → Mostrar modal
                if (totalNotificaciones > 0) {
                    abrirModalNotificaciones();
                } 
                // CASO 2: No hay notificaciones → Toggle silencio
                else {
                    toggleSilencio();
                }
            });
        }

        // ==========================================
        //  EVENTO: CERRAR MODAL (BOTÓN X)
        // ==========================================
        if (btnCerrarModalNotif) {
            btnCerrarModalNotif.addEventListener('click', cerrarModalNotificaciones);
        }
        
        // ==========================================
        //  EVENTO: MARCAR COMO VISTO
        // ==========================================
        if (btnMarcarVisto) {
            btnMarcarVisto.addEventListener('click', marcarComoVisto);
        }
        
        // Cerrar modal al hacer clic fuera
        if (modalNotif) {
            modalNotif.addEventListener('click', (e) => {
                if (e.target === modalNotif) {
                    cerrarModalNotificaciones();
                }
            });
        }

        // Cerrar con tecla ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modalNotif && modalNotif.classList.contains('visible')) {
                cerrarModalNotificaciones();
            }
        });

        // ==========================================
        //  1. Solicitar permiso de notificaciones
        // ==========================================
        const permiso = await notificacionesRealtime.solicitarPermiso();
        console.log(`📢 Permiso: ${permiso ? '✅ Concedido' : '❌ Denegado'}`);
        
        // ==========================================
        //  2. Iniciar escucha en tiempo real
        // ==========================================
        const escuchaActiva = notificacionesRealtime.iniciarEscucha(user.uid, (notificacion) => {
            console.log('📨 Nueva notificación recibida:', notificacion);
            
            // Verificar si ya existe esta notificación (evitar duplicados)
            const idUnico = `${notificacion.id}-${notificacion.estadoNuevo}`;
            if (notificacionesVistas.has(idUnico)) {
                console.log('⚠️ Notificación duplicada ignorada');
                return;
            }
            
            // Guardar notificación
            notificacionesVistas.add(idUnico);
            alertasPendientesLocales.push({
                id: notificacion.id,
                folio: notificacion.folio || notificacion.id,
                titulo: notificacion.titulo,
                estado: notificacion.estadoNuevo,
                estadoAnterior: notificacion.estadoAnterior,
                timestamp: new Date()
            });
            
            // Actualizar UI
            actualizarBadgeNotificaciones();
            
            // Mostrar notificación nativa si no está silenciado
            // (!notificacionesSilenciadas) {
              //notificacionesRealtime.mostrarNotificacion(
               //   notificacion.titulo || 'Estado actualizado',
              //    `${notificacion.titulo || 'Reporte'}: ${notificacion.estadoAnterior} → ${notificacion.estadoNuevo}`
              //);
           //
        });
        
        if (escuchaActiva) {
            console.log('✅ Sistema de notificaciones activo');
        }
        
        return true;
    } catch (error) {
        console.error('❌ Error al iniciar notificaciones:', error);
        return false;
    }
}

// ==========================================
//  FUNCIÓN: ESPERAR SESIÓN
// ==========================================
function esperarSesion(timeout = 10000) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                unsubscribe();
                resolve(user);
            } else if (Date.now() - startTime > timeout) {
                unsubscribe();
                reject(new Error('Tiempo de espera agotado'));
            }
        });
    });
}

// ==========================================
//  INICIALIZAR MENÚ
// ==========================================
(async function initMenu() {
    console.log("🔵 Iniciando menú...");
    
    await procesarVerificacion();
    
    try {
        console.log("⏳ Esperando sesión de Firebase...");
        const user = await esperarSesion(10000);
        
        if (user) {
            console.log("✅ Sesión obtenida:", user.email);
            
            await user.reload();
            
            if (!user.emailVerified) {
                mostrarAlertaVerificacion();
            }
            
            await cargarDatosUsuario(user);
            await iniciarNotificaciones(user);
            
        } else {
            console.log("❌ No se pudo obtener sesión");
            window.location.href = 'login.html';
        }
    } catch (error) {
        console.error("❌ Error al esperar sesión:", error);
        window.location.href = 'login.html';
    }
})();

// ==========================================
//  CERRAR SESIÓN
// ==========================================
const btnLogout = document.getElementById('btn-logout');
if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
        if (confirm("¿Estás seguro de que deseas cerrar sesión?")) {
            try {
                notificacionesRealtime.detenerEscucha();
                await signOut(auth);
                window.location.href = 'login.html';
            } catch (error) {
                console.error("Error al cerrar sesión:", error);
                mostrarToast("No se pudo cerrar la sesión. Inténtalo de nuevo.", 'error');
            }
        }
    });
}

window.addEventListener('beforeunload', () => {
    notificacionesRealtime.detenerEscucha();
});