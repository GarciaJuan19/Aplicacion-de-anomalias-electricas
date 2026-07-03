import { db, auth } from './firebase-config.js';
import { collection, query, where, orderBy, onSnapshot, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

let reportesGlobales = [];
let filtroActual = 'Todos';

document.addEventListener('DOMContentLoaded', () => {
    const contenedorReportes = document.getElementById('contenedor-reportes');
    const botonesFiltro = document.querySelectorAll('.filter-tabs .tab');
    const modalReporte = document.getElementById('modal-reporte');
    const btnCerrarModal = document.getElementById('btn-cerrar-modal');

    // ============================================================
    // CERRAR MODAL
    // ============================================================
    function cerrarModal() {
        if (modalReporte) {
            modalReporte.classList.add('hidden');
            document.body.style.overflow = '';
        }
    }

    if (btnCerrarModal) {
        btnCerrarModal.addEventListener('click', cerrarModal);
    }

    // Cerrar al hacer clic fuera del contenido
    if (modalReporte) {
        modalReporte.addEventListener('click', (e) => {
            if (e.target === modalReporte) {
                cerrarModal();
            }
        });

        // Cerrar con Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !modalReporte.classList.contains('hidden')) {
                cerrarModal();
            }
        });
    }

    // ============================================================
    // AUTH STATE
    // ============================================================
    onAuthStateChanged(auth, (user) => {
        if (user) {
            console.log("✅ Usuario activo:", user.uid);

            const q = query(
                collection(db, "reportes"),
                where("idUsuario", "==", user.uid),
                orderBy("fechaCreacion", "desc")
            );

            onSnapshot(q, (querySnapshot) => {
                reportesGlobales = [];
                querySnapshot.forEach((doc) => {
                    reportesGlobales.push({ id: doc.id, ...doc.data() });
                });
                console.log("📊 Reportes encontrados:", reportesGlobales.length);
                renderizarReportes(filtroActual);
            }, (error) => {
                console.error("❌ Error:", error);
            });

        } else {
            console.warn("⚠️ Usuario no autenticado");
            if (contenedorReportes) {
                contenedorReportes.innerHTML = `
                    <div class="no-reports-fallback">
                        <i class='bx bx-error-circle'></i>
                        <p>Debes iniciar sesión para ver tus reportes.</p>
                    </div>`;
            }
        }
    });

    // ============================================================
    // FILTROS
    // ============================================================
    botonesFiltro.forEach(boton => {
        boton.addEventListener('click', () => {
            botonesFiltro.forEach(b => b.classList.remove('active'));
            boton.classList.add('active');
            filtroActual = boton.textContent.trim();
            renderizarReportes(filtroActual);
        });
    });

    // ============================================================
    // NORMALIZAR TEXTO
    // ============================================================
    function normalizar(texto) {
        return texto
            .toLowerCase()
            .trim()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");
    }

    // ============================================================
    // OBTENER ICONO POR TIPO
    // ============================================================
    function getIconoPorTipo(tipo) {
        
        return 'bx bx-error';
    }

    function getClaseIcono(tipo) {
        const tipoLower = (tipo || '').toLowerCase();
        if (tipoLower.includes('poste')) return 'type-poste';
        if (tipoLower.includes('cable')) return 'type-cable';
        if (tipoLower.includes('corto')) return 'type-corto';
        if (tipoLower.includes('luz') || tipoLower.includes('apagón')) return 'type-sin_luz';
        if (tipoLower.includes('voltaje')) return 'type-voltaje';
        if (tipoLower.includes('luminaria')) return 'type-luminaria';
        return '';
    }

    // ============================================================
    // RENDERIZAR REPORTES
    // ============================================================
    function renderizarReportes(filtro) {
        if (!contenedorReportes) return;
        contenedorReportes.innerHTML = '';

        if (reportesGlobales.length === 0) {
            contenedorReportes.innerHTML = `
                <div class="no-reports-fallback">
                    <i class='bx bx-notepad'></i>
                    <p>No tienes reportes aún. ¡Reporta tu primera anomalía!</p>
                </div>`;
            return;
        }

        let reportesFiltrados = reportesGlobales;
        if (filtro !== 'Todos') {
            reportesFiltrados = reportesGlobales.filter(reporte => {
                const estadoReporte = normalizar(reporte.estado || 'pendiente');
                const estadoFiltro = normalizar(filtro);

                if (estadoFiltro === 'pendiente') {
                    return estadoReporte === 'pendiente' || estadoReporte === 'enviado';
                }

                return estadoReporte === estadoFiltro;
            });
        }

        if (reportesFiltrados.length === 0) {
            contenedorReportes.innerHTML = `
                <div class="no-reports-fallback">
                    <i class='bx bx-notepad'></i>
                    <p>No tienes reportes en estado <strong>"${filtro}"</strong>.</p>
                </div>`;
            return;
        }

        reportesFiltrados.forEach(reporte => {
            let claseEstado = 'status-default';
            const estadoNormalizado = normalizar(reporte.estado || 'pendiente');

            if (estadoNormalizado === 'pendiente' || estadoNormalizado === 'enviado') {
                claseEstado = 'status-sent';
            } else if (estadoNormalizado === 'en revision') {
                claseEstado = 'status-review';
            } else if (estadoNormalizado === 'resuelto') {
                claseEstado = 'status-resolved';
            }

            let fechaLegible = "Fecha no disponible";
            if (reporte.fechaCreacion) {
                try {
                    const fechaObjeto = new Date(reporte.fechaCreacion);
                    if (!isNaN(fechaObjeto.getTime())) {
                        fechaLegible = fechaObjeto.toLocaleDateString('es-ES', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        });
                    }
                } catch (e) {
                    console.warn("Error al formatear fecha:", e);
                }
            }

            const estadoMostrar = reporte.estado || 'Pendiente';
            const estadoCapitalizado = estadoMostrar.charAt(0).toUpperCase() + estadoMostrar.slice(1).toLowerCase();
            const icono = getIconoPorTipo(reporte.tipoAnomalia);
            const claseIcono = getClaseIcono(reporte.tipoAnomalia);

            const tarjeta = document.createElement('div');
            tarjeta.className = 'report-card';
            tarjeta.dataset.id = reporte.id;

            tarjeta.innerHTML = `
                <div class="card-main-info">
                    <div class="report-icon-bg ${claseIcono}">
                        <i class='${icono}'></i>
                    </div>
                    <div class="report-details">
                        <h3>${reporte.tipoAnomalia || 'Anomalía reportada'}</h3>
                        <p class="report-location">
                            <i class='bx bx-map'></i> 
                            <span>${reporte.descripcion || 'Sin descripción disponible'}</span>
                        </p>
                        <p class="report-time">
                            <i class='bx bx-time-five'></i> ${fechaLegible}
                        </p>
                    </div>
                </div>
                <span class="status-badge ${claseEstado}">${estadoCapitalizado}</span>
            `;

            // ============================================================
            // ABRIR MODAL AL HACER CLIC
            // ============================================================
            tarjeta.addEventListener('click', () => {
                abrirModal(reporte);
            });

            contenedorReportes.appendChild(tarjeta);
        });
    }

    // ============================================================
    // ABRIR MODAL
    // ============================================================
    function abrirModal(reporte) {
        if (!modalReporte) return;

        const estadoNormalizado = normalizar(reporte.estado || 'pendiente');
        let claseEstado = 'status-default';
        let estadoLabel = 'Pendiente';

        if (estadoNormalizado === 'pendiente' || estadoNormalizado === 'enviado') {
            claseEstado = 'status-sent';
            estadoLabel = 'Pendiente';
        } else if (estadoNormalizado === 'en revision') {
            claseEstado = 'status-review';
            estadoLabel = 'En Revisión';
        } else if (estadoNormalizado === 'resuelto') {
            claseEstado = 'status-resolved';
            estadoLabel = 'Resuelto';
        }

        let fechaLegible = "Fecha no disponible";
        if (reporte.fechaCreacion) {
            try {
                const fechaObjeto = new Date(reporte.fechaCreacion);
                if (!isNaN(fechaObjeto.getTime())) {
                    fechaLegible = fechaObjeto.toLocaleDateString('es-ES', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                }
            } catch (e) {
                console.warn("Error al formatear fecha:", e);
            }
        }

        const icono = getIconoPorTipo(reporte.tipoAnomalia);
        const titulo = reporte.tipoAnomalia || 'Anomalía reportada';

        // Construir HTML del modal
        let modalHTML = `
            <div class="modal-header">
                <h2><i class='${icono}'></i> ${titulo}</h2>
                <button class="btn-close-modal" id="btn-cerrar-modal-inner">✕</button>
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

        // Mostrar ubicación si existe
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

        // Mostrar imagen si existe
        if (reporte.imagenUrl) {
            modalHTML += `
                <div class="modal-field">
                    <label>Evidencia</label>
                    <div class="modal-image">
                        <img src="${reporte.imagenUrl}" alt="Evidencia del reporte" loading="lazy" />
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

        modalHTML += `
            </div>
        `;

        modalReporte.innerHTML = modalHTML;
        modalReporte.classList.remove('hidden');
        document.body.style.overflow = 'hidden';

        // Evento para cerrar modal desde el botón interno
        const btnCerrarInner = document.getElementById('btn-cerrar-modal-inner');
        if (btnCerrarInner) {
            btnCerrarInner.addEventListener('click', cerrarModal);
        }
    }
});