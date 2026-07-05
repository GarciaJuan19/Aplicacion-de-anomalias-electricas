import { db, auth } from './firebase-config.js';
import { 
    collection, 
    query, 
    where, 
    orderBy, 
    onSnapshot, 
    doc, 
    getDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { mostrarToast } from './utils.js';
import notificacionesRealtime from './notificaciones-realtime.js';

// ==========================================
//  ESTADO GLOBAL
// ==========================================
let reportesGlobales = [];
let filtroActual = 'Todos';
let unsubscribeReportes = null;

// ==========================================
//  REFERENCIAS DOM
// ==========================================
let contenedorReportes = null;
let botonesFiltro = null;
let modalReporte = null;
let btnCerrarModal = null;

// ==========================================
//  FUNCIONES UTILITARIAS
// ==========================================

function normalizar(texto) {
    if (!texto) return '';
    return texto
        .toLowerCase()
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

function formatearFecha(fechaCreacion) {
    if (!fechaCreacion) return "Fecha no disponible";
    
    try {
        const fechaObjeto = new Date(fechaCreacion);
        if (isNaN(fechaObjeto.getTime())) return "Fecha no disponible";
        
        return fechaObjeto.toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (e) {
        console.warn("Error al formatear fecha:", e);
        return "Fecha no disponible";
    }
}

function getClaseIcono(tipo) {
    if (!tipo) return '';
    const tipoLower = tipo.toLowerCase();
    if (tipoLower.includes('poste')) return 'type-poste';
    if (tipoLower.includes('cable')) return 'type-cable';
    if (tipoLower.includes('corto')) return 'type-corto';
    if (tipoLower.includes('luz') || tipoLower.includes('apagón')) return 'type-sin_luz';
    if (tipoLower.includes('voltaje')) return 'type-voltaje';
    if (tipoLower.includes('luminaria')) return 'type-luminaria';
    return '';
}

function getIconoPorTipo(tipo) {
    if (!tipo) return 'bx bx-error';
    const tipoLower = tipo.toLowerCase();
    if (tipoLower.includes('poste')) return 'bx bx-grid-alt';
    if (tipoLower.includes('cable')) return 'bx bx-cable';
    if (tipoLower.includes('corto')) return 'bx bx-flash';
    if (tipoLower.includes('luz') || tipoLower.includes('apagón')) return 'bx bx-bulb';
    if (tipoLower.includes('voltaje')) return 'bx bx-bolt';
    if (tipoLower.includes('luminaria')) return 'bx bx-street-view';
    return 'bx bx-error';
}

function getClaseEstado(estado) {
    const estadoNormalizado = normalizar(estado || 'pendiente');
    
    if (estadoNormalizado === 'pendiente' || estadoNormalizado === 'enviado') {
        return 'status-sent';
    } else if (estadoNormalizado === 'en revision' || estadoNormalizado === 'en revisión') {
        return 'status-review';
    } else if (estadoNormalizado === 'resuelto') {
        return 'status-resolved';
    }
    return 'status-default';
}

function getEstadoLabel(estado) {
    const estadoNormalizado = normalizar(estado || 'pendiente');
    
    if (estadoNormalizado === 'pendiente' || estadoNormalizado === 'enviado') {
        return 'Pendiente';
    } else if (estadoNormalizado === 'en revision' || estadoNormalizado === 'en revisión') {
        return 'En Revisión';
    } else if (estadoNormalizado === 'resuelto') {
        return 'Resuelto';
    }
    return estado || 'Pendiente';
}

// ==========================================
//  FUNCIÓN: CERRAR MODAL
// ==========================================
function cerrarModal() {
    if (modalReporte) {
        modalReporte.classList.add('hidden');
        document.body.style.overflow = '';
    }
}

// ==========================================
//  FUNCIÓN: ABRIR MODAL CON DETALLES
// ==========================================
function abrirModal(reporte) {
    if (!modalReporte) {
        console.error('❌ Modal no disponible');
        return;
    }

    const claseEstado = getClaseEstado(reporte.estado);
    const estadoLabel = getEstadoLabel(reporte.estado);
    const fechaLegible = formatearFecha(reporte.fechaCreacion);
    const icono = getIconoPorTipo(reporte.tipoAnomalia);
    const titulo = reporte.tipoAnomalia || 'Anomalía reportada';

    let modalHTML = `
        <div class="modal-header">
            <h2><i class='${icono}'></i> ${titulo}</h2>
            <button class="btn-close-modal" id="btn-cerrar-modal-inner">
                <i class='bx bx-x'></i>
            </button>
        </div>
        <div class="modal-body">
            <div class="modal-field">
                <label>Estado</label>
                <div class="field-value status-badge ${claseEstado}">${estadoLabel}</div>
            </div>

            <div class="modal-field">
                <label>Descripción</label>
                <div class="field-value">${reporte.descripcion || 'Sin descripción'}</div>
            </div>

            <div class="modal-field">
                <label>Fecha de reporte</label>
                <div class="field-value">${fechaLegible}</div>
            </div>
    `;

    if (reporte.ubicacion || (reporte.latitud && reporte.longitud)) {
        modalHTML += `
            <div class="modal-field">
                <label>Ubicación</label>
                <div class="modal-location">
                    <i class='bx bx-map-pin'></i>
                    <span>${reporte.ubicacion || 'Ubicación capturada'}</span>
                </div>
                ${reporte.latitud && reporte.longitud ? `
                    <div class="modal-coordinates">
                        <span>Lat: ${reporte.latitud}</span>
                        <span>Lng: ${reporte.longitud}</span>
                    </div>
                ` : ''}
            </div>
        `;
    }

    const imagenUrl = reporte.imagenUrl || reporte.fotoUrl;
    if (imagenUrl) {
        modalHTML += `
            <div class="modal-field">
                <label>Evidencia</label>
                <div class="modal-image">
                    <img src="${imagenUrl}" alt="Evidencia del reporte" loading="lazy" />
                </div>
            </div>
        `;
    } else {
        modalHTML += `
            <div class="modal-field">
                <label>Evidencia</label>
                <div class="modal-image">
                    <div class="no-image">
                        <i class='bx bx-image-alt'></i>
                        <span>Sin evidencia adjunta</span>
                    </div>
                </div>
            </div>
        `;
    }

    modalHTML += `</div>`;

    modalReporte.innerHTML = modalHTML;
    modalReporte.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    const btnCerrarInner = document.getElementById('btn-cerrar-modal-inner');
    if (btnCerrarInner) {
        btnCerrarInner.addEventListener('click', function(e) {
            e.stopPropagation();
            cerrarModal();
        });
    }
}

// ==========================================
//  FUNCIÓN: RENDERIZAR REPORTES
// ==========================================
function renderizarReportes(filtro) {
    if (!contenedorReportes) return;
    contenedorReportes.innerHTML = '';

    // Mostrar loading si no hay reportes
    if (reportesGlobales.length === 0) {
        contenedorReportes.innerHTML = `
            <div class="loading-state">
                <i class='bx bx-loader-alt bx-spin'></i>
                <p>Cargando tus reportes...</p>
            </div>`;
        return;
    }

    // Filtrar reportes
    let reportesFiltrados = reportesGlobales;
    if (filtro !== 'Todos') {
        const filtroNormalizado = normalizar(filtro);
        reportesFiltrados = reportesGlobales.filter(reporte => {
            const estadoReporte = normalizar(reporte.estado || 'pendiente');
            
            if (filtroNormalizado === 'pendiente') {
                return estadoReporte === 'pendiente' || estadoReporte === 'enviado';
            }
            return estadoReporte === filtroNormalizado;
        });
    }

    // Mostrar estado vacío
    if (reportesFiltrados.length === 0) {
        const filtroMostrar = filtro === 'Todos' ? '' : ` en estado <strong>"${filtro}"</strong>`;
        contenedorReportes.innerHTML = `
            <div class="no-reports-fallback">
                <i class='bx bx-notepad'></i>
                <h3>No hay reportes${filtroMostrar}</h3>
                <p>${filtro === 'Todos' ? '¡Reporta tu primera anomalía!' : 'Cambia el filtro para ver otros reportes.'}</p>
                ${filtro === 'Todos' ? `
                    <a href="index.html" class="btn-primary">
                        <i class='bx bx-plus-circle'></i> Reportar anomalía
                    </a>
                ` : ''}
            </div>`;
        return;
    }

    // Renderizar cada reporte
    reportesFiltrados.forEach(reporte => {
        const claseEstado = getClaseEstado(reporte.estado);
        const estadoLabel = getEstadoLabel(reporte.estado);
        const fechaLegible = formatearFecha(reporte.fechaCreacion);
        const icono = getIconoPorTipo(reporte.tipoAnomalia);
        const claseIcono = getClaseIcono(reporte.tipoAnomalia);
        const titulo = reporte.tipoAnomalia || 'Anomalía reportada';
        const descripcion = reporte.descripcion || 'Sin descripción disponible';

        const tarjeta = document.createElement('div');
        tarjeta.className = 'report-card';
        tarjeta.dataset.id = reporte.id;
        tarjeta.setAttribute('role', 'button');
        tarjeta.setAttribute('tabindex', '0');
        tarjeta.setAttribute('aria-label', `Ver detalles de ${titulo}`);

        tarjeta.innerHTML = `
            <div class="card-main-info">
                <div class="report-icon-bg ${claseIcono}">
                    <i class='${icono}'></i>
                </div>
                <div class="report-details">
                    <h3>${titulo}</h3>
                    <p class="report-location">
                        <i class='bx bx-map'></i> 
                        <span>${descripcion}</span>
                    </p>
                    <p class="report-time">
                        <i class='bx bx-time-five'></i> ${fechaLegible}
                    </p>
                </div>
            </div>
            <span class="status-badge ${claseEstado}">${estadoLabel}</span>
        `;

        tarjeta.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                abrirModal(reporte);
            }
        });

        contenedorReportes.appendChild(tarjeta);
    });

    actualizarContadorNotificaciones();
}

// ==========================================
//  FUNCIÓN: ACTUALIZAR CONTADOR
// ==========================================
function actualizarContadorNotificaciones() {
    try {
        const stats = notificacionesRealtime.getEstadisticas();
        const badge = document.getElementById('badge-notificaciones');
        if (badge) {
            const total = (stats.pendientes || 0) + (stats.enRevision || 0);
            if (total > 0) {
                badge.textContent = total > 99 ? '99+' : total;
                badge.classList.add('visible');
            } else {
                badge.classList.remove('visible');
            }
        }
    } catch (e) {
        // Silencioso - el módulo de notificaciones puede no estar disponible
    }
}

// ==========================================
//  FUNCIÓN: INICIALIZAR FILTROS
// ==========================================
function inicializarFiltros() {
    if (!botonesFiltro) return;
    
    botonesFiltro.forEach(boton => {
        boton.addEventListener('click', function() {
            botonesFiltro.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            filtroActual = this.textContent.trim();
            renderizarReportes(filtroActual);
        });
    });

    if (botonesFiltro.length > 0) {
        botonesFiltro[0].classList.add('active');
    }
}

// ==========================================
//  INICIALIZACIÓN - DOM
// ==========================================

// Asignar referencias del DOM (después de que el DOM esté listo)
contenedorReportes = document.getElementById('contenedor-reportes');
botonesFiltro = document.querySelectorAll('.filter-tabs .tab');
modalReporte = document.getElementById('modal-reporte');
btnCerrarModal = document.getElementById('btn-cerrar-modal');

// Inicializar filtros
inicializarFiltros();

// ==========================================
//  EVENTOS DEL MODAL
// ==========================================

// Cerrar modal con botón externo
if (btnCerrarModal) {
    btnCerrarModal.addEventListener('click', cerrarModal);
}

// Cerrar modal al hacer clic fuera
if (modalReporte) {
    modalReporte.addEventListener('click', function(e) {
        if (e.target === this) {
            cerrarModal();
        }
    });
}

// Cerrar con tecla Escape
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && modalReporte && !modalReporte.classList.contains('hidden')) {
        cerrarModal();
    }
});

// ==========================================
//  AUTH Y FIRESTORE
// ==========================================
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log("✅ Usuario activo:", user.uid);

        const q = query(
            collection(db, "reportes"),
            where("idUsuario", "==", user.uid),
            orderBy("fechaCreacion", "desc")
        );

        // Iniciar escucha en tiempo real
        unsubscribeReportes = onSnapshot(q, (querySnapshot) => {
            reportesGlobales = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                reportesGlobales.push({ 
                    id: doc.id, 
                    ...data,
                    imagenUrl: data.imagenUrl || data.fotoUrl || null
                });
            });
            console.log("📊 Reportes encontrados:", reportesGlobales.length);
            renderizarReportes(filtroActual);
        }, (error) => {
            console.error("❌ Error en snapshot:", error);
            if (contenedorReportes) {
                contenedorReportes.innerHTML = `
                    <div class="no-reports-fallback">
                        <i class='bx bx-error-circle'></i>
                        <p>Error al cargar reportes: ${error.message}</p>
                    </div>`;
            }
        });

    } else {
        console.warn("⚠️ Usuario no autenticado");
        if (contenedorReportes) {
            contenedorReportes.innerHTML = `
                <div class="no-reports-fallback">
                    <i class='bx bx-error-circle'></i>
                    <p>Debes iniciar sesión para ver tus reportes.</p>
                    <a href="login.html" class="btn-primary">
                        <i class='bx bx-log-in'></i> Iniciar sesión
                    </a>
                </div>`;
        }
    }
});

// ==========================================
//  LIMPIEZA AL SALIR
// ==========================================
window.addEventListener('beforeunload', function() {
    if (unsubscribeReportes) {
        unsubscribeReportes();
        unsubscribeReportes = null;
        console.log("🛑 Escucha de reportes detenida");
    }
});

console.log("📋 Mis reportes - Inicializado");