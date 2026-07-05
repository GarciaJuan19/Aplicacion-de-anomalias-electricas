// ==========================================
//  ADMIN.JS - COMPLETO CON NOTIFICACIONES
// ==========================================

import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    collection, 
    onSnapshot, 
    doc, 
    updateDoc, 
    query, 
    orderBy, 
    getDoc, 
    addDoc,
    where
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import notificationManager from './notificaciones.js';

document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('reports-container');
    const searchInput = document.getElementById('search-input');
    const pills = document.querySelectorAll('.status-filters .filter-tab');
    const btnLogout = document.getElementById('btn-logout');
    const avatarContainer = document.getElementById('admin-avatar-container');

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

    // ==========================================
    //  UTILIDADES
    // ==========================================

    // ✅ Quita acentos y pasa a minúsculas
    function normalizarTexto(texto) {
        if (!texto) return '';
        return texto
            .toString()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim();
    }

    // ✅ Formatear fecha
    function formatearFecha(fecha_creacion) {
        let fecha;
        if (!fecha_creacion) return "Sin fecha";
        if (typeof fecha_creacion.toDate === 'function') {
            fecha = fecha_creacion.toDate();
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

    // ==========================================
    //  FUNCIONES DE NOTIFICACIONES
    // ==========================================

    // ✅ ENVIAR NOTIFICACIÓN AL USUARIO
    async function enviarNotificacionUsuario(usuarioId, reporteId, estadoNuevo, tipoAnomalia) {
        try {
            console.log('📨 Preparando notificación para usuario:', usuarioId);
            
            // 1. Obtener el usuario desde Firestore
            const userRef = doc(db, "usuarios", usuarioId);
            const userSnap = await getDoc(userRef);
            
            if (!userSnap.exists()) {
                console.warn('⚠️ Usuario no encontrado en Firestore');
                return false;
            }

            const userData = userSnap.data();
            console.log('👤 Datos del usuario:', userData);
            
            // 2. Verificar si tiene suscripción push
            const tieneSuscripcion = userData.subscription && userData.subscription.endpoint;
            
            // 3. Construir mensaje según el estado
            const mensajes = {
                'pendiente': {
                    title: '📋 Reporte Pendiente',
                    body: `Tu reporte "${tipoAnomalia}" está pendiente de revisión.`,
                    icon: '/img/Logo3.png'
                },
                'en revisión': {
                    title: '🔍 Reporte en Revisión',
                    body: `Estamos revisando tu reporte "${tipoAnomalia}".`,
                    icon: '/img/Logo3.png'
                },
                'en revision': {
                    title: '🔍 Reporte en Revisión',
                    body: `Estamos revisando tu reporte "${tipoAnomalia}".`,
                    icon: '/img/Logo3.png'
                },
                'resuelto': {
                    title: '✅ Reporte Resuelto',
                    body: `¡Tu reporte "${tipoAnomalia}" ha sido resuelto!`,
                    icon: '/img/Logo3.png'
                },
                'rechazado': {
                    title: '❌ Reporte Rechazado',
                    body: `Tu reporte "${tipoAnomalia}" ha sido rechazado.`,
                    icon: '/img/Logo3.png'
                }
            };

            const mensaje = mensajes[estadoNuevo.toLowerCase()] || {
                title: '📢 Estado Actualizado',
                body: `Tu reporte "${tipoAnomalia}" cambió a: ${estadoNuevo}`,
                icon: '/img/Logo3.png'
            };

            // 4. Guardar en historial de notificaciones (SIEMPRE)
            try {
                const notificacionRef = collection(db, "notificaciones");
                await addDoc(notificacionRef, {
                    usuarioId: usuarioId,
                    reporteId: reporteId,
                    estado: estadoNuevo,
                    estadoAnterior: null, // Se actualizará después
                    mensaje: mensaje.body,
                    titulo: mensaje.title,
                    fechaEnvio: new Date().toISOString(),
                    leida: false,
                    tipo: 'push'
                });
                console.log('✅ Notificación registrada en historial');
            } catch (error) {
                console.error('❌ Error guardando notificación en historial:', error);
            }

            // 5. Si tiene suscripción, enviar push
            if (tieneSuscripcion) {
                console.log('📨 Enviando notificación push...');
                // Aquí iría la lógica para enviar push real
                // Por ahora solo lo registramos
            }

            // 6. SIEMPRE mostrar notificación local (para pruebas)
            if (Notification.permission === 'granted') {
                console.log('📢 Mostrando notificación local...');
                try {
                    const notification = new Notification(mensaje.title, {
                        body: mensaje.body,
                        icon: mensaje.icon,
                        tag: `reporte-${reporteId}`,
                        requireInteraction: true,
                        vibrate: [200, 100, 200]
                    });

                    // Al hacer clic en la notificación
                    notification.onclick = () => {
                        window.focus();
                        notification.close();
                        // Redirigir al detalle del reporte si es posible
                    };

                    // Cerrar después de 8 segundos
                    setTimeout(() => {
                        if (notification.close) notification.close();
                    }, 8000);
                } catch (error) {
                    console.error('❌ Error mostrando notificación:', error);
                }
            }

            console.log('✅ Notificación procesada correctamente');
            return true;

        } catch (error) {
            console.error('❌ Error enviando notificación:', error);
            return false;
        }
    }

    // ✅ ACTUALIZAR ESTADO CON NOTIFICACIÓN
    async function actualizarEstadoReporte(id, nuevoEstado) {
        const docRef = doc(db, "reportes", id);
        const timestampActual = new Date().toISOString();
        
        try {
            // 1. Obtener datos actuales del reporte
            const reporteSnap = await getDoc(docRef);
            if (!reporteSnap.exists()) {
                alert("❌ El reporte no existe.");
                return;
            }
            
            const reporteData = reporteSnap.data();
            const estadoAnterior = reporteData.estado || "pendiente";
            
            // Si el estado no cambió, no hacer nada
            if (estadoAnterior.toLowerCase() === nuevoEstado.toLowerCase()) {
                alert("⚠️ El reporte ya está en ese estado.");
                return;
            }
            
            // 2. Actualizar estado en Firestore
            let datosActualizados = { 
                estado: nuevoEstado, 
                ultima_modificacion: timestampActual,
                estadoAnterior: estadoAnterior,
                fechaCambioEstado: timestampActual
            };
            
            if (nuevoEstado.toLowerCase() === "resuelto") {
                datosActualizados.fecha_resolucion = timestampActual;
            }
            
            await updateDoc(docRef, datosActualizados);
            
            console.log(`✅ Estado actualizado: ${estadoAnterior} → ${nuevoEstado}`);
            
            // 3. ENVIAR NOTIFICACIÓN AL USUARIO
            let notificacionEnviada = false;
            if (reporteData.idUsuario) {
                console.log('📨 Enviando notificación al usuario...');
                notificacionEnviada = await enviarNotificacionUsuario(
                    reporteData.idUsuario,
                    id,
                    nuevoEstado,
                    reporteData.tipoAnomalia || "Reporte"
                );
                
                if (notificacionEnviada) {
                    alert(`✅ Estado actualizado a "${nuevoEstado}" y notificación enviada al usuario.`);
                } else {
                    alert(`✅ Estado actualizado a "${nuevoEstado}". (No se pudo enviar notificación)`);
                }
            } else {
                alert(`✅ Estado actualizado a "${nuevoEstado}".`);
            }
            
            // 4. Actualizar la vista
            renderizarReportes();
            
            // 5. Cerrar el modal si está abierto
            const modalDetalle = document.getElementById('modal-detalle');
            if (modalDetalle && modalDetalle.style.display === 'flex') {
                modalDetalle.style.display = 'none';
                document.body.style.overflow = '';
            }
            
        } catch (error) {
            console.error("❌ Error:", error);
            alert("❌ No se pudo guardar el cambio.");
        }
    }

    // ==========================================
    //  FUNCIONES DE UI
    // ==========================================

    // ✅ Marcar botón de estado activo
    function marcarBotonEstadoActivo(estadoActual) {
        const estadoNormalizado = normalizarTexto(estadoActual) || 'pendiente';
        document.querySelectorAll('.btn-estado-modal').forEach(btn => {
            const estadoBtn = normalizarTexto(btn.getAttribute('data-estado'));
            btn.classList.toggle('active', estadoBtn === estadoNormalizado);
        });
    }

    // ✅ Abrir modal de detalle
    async function abrirModalDetalle(reporte) {
        reporteSeleccionadoId = reporte.id;

        document.getElementById('modal-tipo').textContent = reporte.tipoAnomalia || 'Falla Eléctrica';

        const estadoFormateado = reporte.estado ? reporte.estado.toUpperCase() : "PENDIENTE";
        const badge = document.getElementById('modal-badge');
        badge.textContent = estadoFormateado;
        badge.className = 'badge-status';
        if (estadoFormateado === "EN REVISIÓN" || estadoFormateado === "EN REVISION") badge.classList.add('en-revision');
        else if (estadoFormateado === "RESUELTO") badge.classList.add('resuelto');
        else badge.classList.add('pendiente');

        marcarBotonEstadoActivo(reporte.estado);

        let fechaMostrar = "Sin fecha";
        const fechaRaw = reporte.fechaCreacion;
        if (fechaRaw) {
            const fechaLimpia = fechaRaw.replace('T', ' ').replace('Z', '');
            const f = new Date(fechaLimpia + ' UTC');
            if (!isNaN(f.getTime())) {
                fechaMostrar = f.toLocaleDateString('es-MX', {
                    day: '2-digit', month: 'long', year: 'numeric'
                }) + " a las " + f.toLocaleTimeString('es-MX', {
                    hour: '2-digit', minute: '2-digit'
                });
            } else {
                const partes = fechaRaw.split('T');
                const [anio, mes, dia] = partes[0].split('-');
                const hora = partes[1].substring(0, 5);
                fechaMostrar = `${dia}/${mes}/${anio} a las ${hora}`;
            }
        }
        document.getElementById('detalle-fecha').textContent = fechaMostrar;

        document.getElementById('modal-descripcion').textContent = reporte.descripcion || 'Sin descripción.';

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

        const modalUsuario = document.getElementById('modal-usuario');
        modalUsuario.textContent = 'Cargando...';
        if (reporte.idUsuario) {
            try {
                const userRef = doc(db, "usuarios", reporte.idUsuario);
                const userSnap = await getDoc(userRef);
                if (userSnap.exists()) {
                    const userData = userSnap.data();
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

        modalDetalle.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    // ✅ Renderizar reportes
    function renderizarReportes() {
        const textoBusqueda = searchInput.value.toLowerCase().trim();
        container.innerHTML = "";

        const reportesFiltrados = todosLosReportes.filter(reporte => {
            const estadoDB = reporte.estado ? reporte.estado.toUpperCase() : "PENDIENTE";
            const coincideEstado = (filtroEstadoActual === 'Todos' || estadoDB === filtroEstadoActual);
            const tituloDoc = (reporte.tipoAnomalia || "").toLowerCase();
            const descDoc = (reporte.descripcion || "").toLowerCase();
            const coincideTexto = tituloDoc.includes(textoBusqueda) || descDoc.includes(textoBusqueda);

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

            let fechaMostrar = "Sin fecha";
            if (reporte.fechaCreacion) {
                const f = new Date(reporte.fechaCreacion);
                if (!isNaN(f)) {
                    fechaMostrar = f.toLocaleDateString('es-MX', {
                        day: '2-digit', month: 'short', year: 'numeric'
                    }) + " " + f.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
                }
            }

            let ubicacionTexto = "Ubicación no disponible";
            if (reporte.ubicacion && reporte.ubicacion.latitud) {
                ubicacionTexto = `Lat: ${reporte.ubicacion.latitud.toFixed(4)}, Lon: ${reporte.ubicacion.longitud.toFixed(4)}`;
            }

            const estadoNormalizado = normalizarTexto(reporte.estado) || 'pendiente';

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
                        <option value="" disabled ${!['pendiente', 'en revision', 'resuelto'].includes(estadoNormalizado) ? 'selected' : ''}>Cambiar Estado</option>
                        <option value="pendiente" ${estadoNormalizado === 'pendiente' ? 'selected' : ''}>Pendiente</option>
                        <option value="en revisión" ${estadoNormalizado === 'en revision' ? 'selected' : ''}>En revisión</option>
                        <option value="resuelto" ${estadoNormalizado === 'resuelto' ? 'selected' : ''}>Resuelto</option>
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
                    e.target.value = estadoNormalizado === 'en revision' ? 'en revisión' : estadoNormalizado;
                }
            });

            container.appendChild(card);
            card.querySelector('.btn-details').addEventListener('click', () => {
                abrirModalDetalle(reporte);
            });
        });
    }

    // ==========================================
    //  CARGA DE DATOS
    // ==========================================

    // ✅ Cargar foto de perfil del admin
    async function cargarFotoPerfilAdmin(user) {
        if (!avatarContainer) return;
        let urlFoto = null;

        try {
            const userRef = doc(db, "usuarios", user.uid);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
                const data = userSnap.data();
                urlFoto = data.photoURL || data.fotoPerfil || data.foto_perfil || null;
            }
        } catch (err) {
            console.error("Error al obtener foto de perfil desde Firestore:", err);
        }

        if (!urlFoto && user.photoURL) {
            urlFoto = user.photoURL;
        }

        if (urlFoto) {
            avatarContainer.innerHTML = `<img src="${urlFoto}" alt="Foto de perfil" referrerpolicy="no-referrer">`;
        }
    }

    // ✅ Cargar reportes desde Firestore
    function cargarReportesFirestore() {
        const q = query(collection(db, "reportes"), orderBy("fechaCreacion", "desc"));

        onSnapshot(q, (snapshot) => {
            todosLosReportes = [];
            snapshot.forEach((documento) => {
                const data = documento.data();
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

    // ==========================================
    //  INICIALIZACIÓN
    // ==========================================

    // ✅ Monitorear autenticación
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const esAdmin = user.email === 'admin1@gmail.com' || user.email.endsWith('@admin.com');
            if (!esAdmin) {
                alert("⛔ Acceso denegado.");
                await signOut(auth);
                window.location.href = 'index.html';
            } else {
                // ✅ INICIALIZAR NOTIFICACIONES
                try {
                    const notificacionesActivas = await notificationManager.init();
                    
                    if (notificacionesActivas) {
                        console.log('✅ Notificaciones push activadas');
                        // Enviar notificación de prueba después de 3 segundos
                        setTimeout(() => {
                            notificationManager.enviarNotificacionPrueba();
                        }, 3000);
                    } else {
                        console.warn('⚠️ No se pudieron activar las notificaciones');
                    }
                } catch (error) {
                    console.error('❌ Error con notificaciones:', error);
                }
                
                cargarReportesFirestore();
                cargarFotoPerfilAdmin(user);
            }
        } else {
            window.location.href = 'index.html';
        }
    });

    // ==========================================
    //  EVENT LISTENERS
    // ==========================================

    // ✅ Filtro por fecha
    btnFilterDate.addEventListener('click', () => {
        modalFecha.style.display = 'flex';
    });

    modalFecha.addEventListener('click', (e) => {
        if (e.target === modalFecha) modalFecha.style.display = 'none';
    });

    document.getElementById('btn-aplicar-fecha').addEventListener('click', () => {
        fechaDesde = inputDesde.value ? new Date(inputDesde.value + 'T00:00:00') : null;
        fechaHasta = inputHasta.value ? new Date(inputHasta.value + 'T23:59:59') : null;
        modalFecha.style.display = 'none';
        btnFilterDate.classList.toggle('filtro-activo', !!(fechaDesde || fechaHasta));
        renderizarReportes();
    });

    document.getElementById('btn-limpiar-fecha').addEventListener('click', () => {
        fechaDesde = null;
        fechaHasta = null;
        inputDesde.value = '';
        inputHasta.value = '';
        btnFilterDate.classList.remove('filtro-activo');
        modalFecha.style.display = 'none';
        renderizarReportes();
    });

    // ✅ Modal detalle
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

    // ✅ Botones de estado dentro del modal
    document.querySelectorAll('.btn-estado-modal').forEach(btn => {
        btn.addEventListener('click', async () => {
            const nuevoEstado = btn.getAttribute('data-estado');
            if (confirm(`¿Cambiar estado a "${nuevoEstado}"?`)) {
                await actualizarEstadoReporte(reporteSeleccionadoId, nuevoEstado);
                marcarBotonEstadoActivo(nuevoEstado);
                modalDetalle.style.display = 'none';
                document.body.style.overflow = '';
            }
        });
    });

    // ✅ Búsqueda
    searchInput.addEventListener('input', renderizarReportes);

    // ✅ Filtros por estado
    pills.forEach(pill => {
        pill.addEventListener('click', (e) => {
            pills.forEach(p => p.classList.remove('active'));
            e.target.classList.add('active');
            filtroEstadoActual = e.target.getAttribute('data-status');
            renderizarReportes();
        });
    });

    // ✅ Cerrar sesión
    btnLogout.addEventListener('click', () => {
        if (confirm("¿Estás seguro de que deseas cerrar sesión?")) {
            signOut(auth).then(() => window.location.href = '../login.html');
        }
    });

    console.log('✅ Admin.js cargado correctamente');
});