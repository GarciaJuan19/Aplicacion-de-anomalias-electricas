import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, onSnapshot, doc, updateDoc, query, orderBy, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('reports-container');
    const searchInput = document.getElementById('search-input');
    const pills = document.querySelectorAll('.filter-pills .pill');
    const btnLogout = document.getElementById('btn-logout');

    let todosLosReportes = [];
    let filtroEstadoActual = 'Todos';
    let fechaDesde = null;
    let fechaHasta = null;
    const modalFecha = document.getElementById('modal-fecha');
    const inputDesde = document.getElementById('fecha-desde');
    const inputHasta = document.getElementById('fecha-hasta');
    const btnFilterDate = document.getElementById('btn-filter-date');
    const modalDetalle = document.getElementById('modal-detalle');
    const btnCerrarModal = document.getElementById('btn-cerrar-modal');
    let reporteSeleccionadoId = null;

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const esAdmin = user.email === 'admin1@gmail.com' || user.email.endsWith('@admin.com');
            if (!esAdmin) {
                alert("⛔ Acceso denegado.");
                await signOut(auth);
                window.location.href = 'index.html';
            } else {
                cargarReportesFirestore();
            }
        } else {
            window.location.href = 'index.html';
        }
        // --- FILTRO POR FECHA ---
        btnFilterDate.addEventListener('click', () => {
            modalFecha.style.display = 'flex';
        });

        // Cerrar modal al hacer clic fuera
        modalFecha.addEventListener('click', (e) => {
            if (e.target === modalFecha) modalFecha.style.display = 'none';
        });

        document.getElementById('btn-aplicar-fecha').addEventListener('click', () => {
    fechaDesde = inputDesde.value ? new Date(inputDesde.value + 'T00:00:00') : null;
    fechaHasta = inputHasta.value ? new Date(inputHasta.value + 'T23:59:59') : null;
    modalFecha.style.display = 'none';

    // ✅ Reemplaza los estilos inline por una clase
    btnFilterDate.classList.toggle('filtro-activo', !!(fechaDesde || fechaHasta));

    renderizarReportes();
});

document.getElementById('btn-limpiar-fecha').addEventListener('click', () => {
    fechaDesde = null;
    fechaHasta = null;
    inputDesde.value = '';
    inputHasta.value = '';
    btnFilterDate.classList.remove('filtro-activo'); // ✅
    modalFecha.style.display = 'none';
    renderizarReportes();
});
        // --- MODAL DETALLE ---
        btnCerrarModal.addEventListener('click', () => {
            modalDetalle.style.display = 'none';
            document.body.style.overflow = '';
        });

        modalDetalle.addEventListener('click', (e) => {
            if (e.target === modalDetalle) {
                modalDetalle.style.display = 'none';
                document.body.style.overflow = '';
            }
        });

        // Botones de estado dentro del modal
        document.querySelectorAll('.btn-estado-modal').forEach(btn => {
            btn.addEventListener('click', async () => {
                const nuevoEstado = btn.getAttribute('data-estado');
                if (confirm(`¿Cambiar estado a "${nuevoEstado}"?`)) {
                    await actualizarEstadoReporte(reporteSeleccionadoId, nuevoEstado);
                    modalDetalle.style.display = 'none';
                    document.body.style.overflow = '';
                }
            });
        });
    });

    // --- LEER REPORTES (cambia el campo de ordenamiento) ---
    function cargarReportesFirestore() {
        const q = query(collection(db, "reportes"), orderBy("fechaCreacion", "desc")); // ✅ camelCase

        onSnapshot(q, (snapshot) => {
            todosLosReportes = [];
            snapshot.forEach((documento) => {
                const data = documento.data();

                // ✅ Manejo del Timestamp de Firestore (fechaCreacion es string ISO en tu caso)
                let fechaOrdenable = 0;
                if (data.fechaCreacion) {
                    fechaOrdenable = new Date(data.fechaCreacion).getTime() || 0;
                }

                todosLosReportes.push({
                    id: documento.id,
                    ...data,
                    _fechaOrdenable: fechaOrdenable
                });
            });

            todosLosReportes.sort((a, b) => b._fechaOrdenable - a._fechaOrdenable);
            renderizarReportes();

        }, (error) => {
            console.error("❌ Error:", error.code, error.message);
            container.innerHTML = `<div class="loading-state"><p>Error: ${error.code}</p></div>`;
        });
    }

    function formatearFecha(fecha_creacion) {
        // ✅ Maneja Timestamp de Firestore, string o número
        let fecha;

        if (!fecha_creacion) return "Sin fecha";

        if (typeof fecha_creacion.toDate === 'function') {
            fecha = fecha_creacion.toDate();  // Timestamp de Firestore
        } else if (typeof fecha_creacion === 'string' || typeof fecha_creacion === 'number') {
            fecha = new Date(fecha_creacion);
        } else {
            return "Fecha inválida";
        }

        if (isNaN(fecha.getTime())) return "Fecha inválida";

        return fecha.toLocaleDateString('es-MX', {
            day: '2-digit', month: 'short', year: 'numeric'
        }) + " " + fecha.toLocaleTimeString('es-MX', {
            hour: '2-digit', minute: '2-digit'
        });
    }
    async function abrirModalDetalle(reporte) {
    reporteSeleccionadoId = reporte.id;

    // --- Tipo y badge ---
    document.getElementById('modal-tipo').textContent = reporte.tipoAnomalia || 'Falla Eléctrica';

    const estadoFormateado = reporte.estado ? reporte.estado.toUpperCase() : "PENDIENTE";
    const badge = document.getElementById('modal-badge');
    badge.textContent = estadoFormateado;
    badge.className = 'badge-status';
    if (estadoFormateado === "EN REVISIÓN" || estadoFormateado === "EN REVISION") badge.classList.add('en-revision');
    else if (estadoFormateado === "RESUELTO") badge.classList.add('resuelto');
    else badge.classList.add('pendiente');

    // --- Fecha (fix: leer fechaCreacion correctamente) ---
// --- Fecha (fix definitivo) ---
let fechaMostrar = "Sin fecha";
const fechaRaw = reporte.fechaCreacion;

if (fechaRaw) {
    // ✅ Reemplaza la T y Z para máxima compatibilidad móvil
    const fechaLimpia = fechaRaw.replace('T', ' ').replace('Z', '');
    const f = new Date(fechaLimpia + ' UTC');

    if (!isNaN(f.getTime())) {
        fechaMostrar = f.toLocaleDateString('es-MX', {
            day: '2-digit', month: 'long', year: 'numeric'
        }) + " a las " + f.toLocaleTimeString('es-MX', {
            hour: '2-digit', minute: '2-digit'
        });
    } else {
        // Fallback: mostrar el string formateado manualmente
        const partes = fechaRaw.split('T');
        const [anio, mes, dia] = partes[0].split('-');
        const hora = partes[1].substring(0, 5);
        fechaMostrar = `${dia}/${mes}/${anio} a las ${hora}`;
    }
}

document.getElementById('detalle-fecha').textContent = fechaMostrar;

console.log("fechaMostrar:", fechaMostrar);
console.log("elemento detalle-fecha:", document.getElementById('detalle-fecha'));

    // --- Descripción ---
    document.getElementById('modal-descripcion').textContent = reporte.descripcion || 'Sin descripción.';

    // --- Ubicación + mini mapa ---
    let ubicacionTexto = "No disponible";
    const mapaContainer = document.getElementById('modal-mapa-container');

    if (reporte.ubicacion && reporte.ubicacion.latitud) {
        const lat = reporte.ubicacion.latitud;
        const lon = reporte.ubicacion.longitud;
        ubicacionTexto = `Lat: ${lat.toFixed(5)}, Lon: ${lon.toFixed(5)}`;
        document.getElementById('modal-mapa').src =
            `https://maps.google.com/maps?q=${lat},${lon}&z=16&output=embed`;
        mapaContainer.style.display = 'block';
    } else {
        mapaContainer.style.display = 'none';
    }
    document.getElementById('modal-ubicacion').textContent = ubicacionTexto;

    // --- Foto ---
    const fotoContainer = document.getElementById('modal-foto-container');
    const fotoPlaceholder = document.getElementById('modal-foto-placeholder');

    if (reporte.fotoUrl) {
        document.getElementById('modal-foto').src = reporte.fotoUrl;
        fotoContainer.style.display = 'block';
        fotoPlaceholder.style.display = 'none';
    } else {
        fotoContainer.style.display = 'none';
        fotoPlaceholder.style.display = 'flex';
    }

    // --- Nombre del usuario desde Firestore ---
    const modalUsuario = document.getElementById('modal-usuario');
    modalUsuario.textContent = 'Cargando...';

    if (reporte.idUsuario) {
        try {
            // ✅ Busca en la colección 'usuarios' con el idUsuario del reporte
            const { getDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
            const userRef = doc(db, "usuarios", reporte.idUsuario);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists()) {
                const userData = userSnap.data();
                // Ajusta 'nombre' al campo real que uses en tu colección usuarios
                modalUsuario.textContent = userData.nombre_completo || userData.displayName || userData.email || reporte.idUsuario;
            } else {
                modalUsuario.textContent = 'Usuario no encontrado';
            }
        } catch (err) {
            console.error("Error al obtener usuario:", err);
            modalUsuario.textContent = reporte.idUsuario;
        }
    } else {
        modalUsuario.textContent = 'Sin usuario';
    }

    // --- Mostrar modal ---
    modalDetalle.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}
    // --- RENDERIZAR (actualiza todos los campos a camelCase) ---
    function renderizarReportes() {
        const textoBusqueda = searchInput.value.toLowerCase().trim();
        container.innerHTML = "";

        const reportesFiltrados = todosLosReportes.filter(reporte => {
            const estadoDB = reporte.estado ? reporte.estado.toUpperCase() : "PENDIENTE";
            const coincideEstado = (filtroEstadoActual === 'Todos' || estadoDB === filtroEstadoActual);

            const tituloDoc = (reporte.tipoAnomalia || "").toLowerCase();
            const descDoc = (reporte.descripcion || "").toLowerCase();
            const coincideTexto = tituloDoc.includes(textoBusqueda) || descDoc.includes(textoBusqueda);

            // ✅ Filtro por fecha
            let coincideFecha = true;
            if (fechaDesde || fechaHasta) {
                const fechaReporte = reporte.fechaCreacion ? new Date(reporte.fechaCreacion) : null;
                if (!fechaReporte || isNaN(fechaReporte)) {
                    coincideFecha = false;
                } else {
                    if (fechaDesde && fechaReporte < fechaDesde) coincideFecha = false;
                    if (fechaHasta && fechaReporte > fechaHasta) coincideFecha = false;
                }
            }

            return coincideEstado && coincideTexto && coincideFecha;
        });

        if (reportesFiltrados.length === 0) {
            container.innerHTML = `<div class="loading-state"><p>No se encontraron incidencias.</p></div>`;
            return;
        }

        reportesFiltrados.forEach(reporte => {
            const estadoFormateado = reporte.estado ? reporte.estado.toUpperCase() : "PENDIENTE";

            let badgeClass = "pendiente";
            if (estadoFormateado === "EN REVISIÓN" || estadoFormateado === "EN REVISION") badgeClass = "en-revision";
            if (estadoFormateado === "RESUELTO") badgeClass = "resuelto";

            // ✅ fechaCreacion camelCase
            let fechaMostrar = "Sin fecha";
            if (reporte.fechaCreacion) {
                const f = new Date(reporte.fechaCreacion);
                if (!isNaN(f)) {
                    fechaMostrar = f.toLocaleDateString('es-MX', {
                        day: '2-digit', month: 'short', year: 'numeric'
                    }) + " " + f.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
                }
            }

            // ✅ ubicacion con los nombres correctos de tu DB
            let ubicacionTexto = "Ubicación no disponible";
            if (reporte.ubicacion && reporte.ubicacion.latitud) {
                ubicacionTexto = `Lat: ${reporte.ubicacion.latitud.toFixed(4)}, Lon: ${reporte.ubicacion.longitud.toFixed(4)}`;
            }

            const card = document.createElement('div');
            card.className = 'report-card';
            card.innerHTML = `
    <div class="card-header-info">
        <div class="title-block">
            <div class="icon-type"><i class='bx bx-error'></i></div>
            <div class="text-meta">
                <h3 style="text-transform: capitalize;">${reporte.tipoAnomalia || 'Falla Eléctrica'}</h3>
                <span><i class='bx bx-time-five'></i> ${fechaMostrar}</span>
            </div>
        </div>
        <span class="badge-status ${badgeClass}">${estadoFormateado}</span>
    </div>
    <div class="card-location">
        <i class='bx bx-map'></i>
        <span>${ubicacionTexto}</span>
    </div>
    <p class="card-desc">
        <strong>Descripción:</strong> ${reporte.descripcion || 'Sin descripción.'}
    </p>
    <div class="card-actions">
        <button class="btn-details">Ver Detalles</button>
        <select class="select-action" data-id="${reporte.id}">
            <option value="" disabled selected>Cambiar Estado</option>
            <option value="pendiente">Pendiente</option>
            <option value="en revisión">En revisión</option>
            <option value="resuelto">Resuelto</option>
        </select>
    </div>
`;

            const select = card.querySelector('.select-action');
            select.addEventListener('change', async (e) => {
                const nuevoEstado = e.target.value;
                const docId = e.target.getAttribute('data-id');
                if (confirm(`¿Confirmas cambiar el estado a "${nuevoEstado}"?`)) {
                    await actualizarEstadoReporte(docId, nuevoEstado);
                } else {
                    e.target.value = "";
                }
            });

            container.appendChild(card);
            // Después de container.appendChild(card)
            card.querySelector('.btn-details').addEventListener('click', () => {
                abrirModalDetalle(reporte);
            });
        });
    }

    async function actualizarEstadoReporte(id, nuevoEstado) {
        const docRef = doc(db, "reportes", id);
        const timestampActual = new Date().toISOString();
        try {
            let datosActualizados = { estado: nuevoEstado, ultima_modificacion: timestampActual };
            if (nuevoEstado === "resuelto") datosActualizados.fecha_resolucion = timestampActual;
            await updateDoc(docRef, datosActualizados);
            alert("✨ Estado actualizado.");
        } catch (error) {
            console.error("Error:", error);
            alert("❌ No se pudo guardar.");
        }
    }

    searchInput.addEventListener('input', renderizarReportes);

    pills.forEach(pill => {
        pill.addEventListener('click', (e) => {
            pills.forEach(p => p.classList.remove('active'));
            e.target.classList.add('active');
            filtroEstadoActual = e.target.getAttribute('data-status');
            renderizarReportes();
        });
    });

    btnLogout.addEventListener('click', () => {
        signOut(auth).then(() => window.location.href = '../login.html');
    });
});
