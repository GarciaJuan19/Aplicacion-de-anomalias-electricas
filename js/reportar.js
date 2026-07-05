import { db, auth } from './firebase-config.js';
import { collection, addDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { subirImagen, generarRutaImagen, fileToBase64 } from './storage-utils.js';

document.addEventListener('DOMContentLoaded', () => {
    
    // --- REFERENCIAS DE DISPARADORES Y CAPTURA ---
    const btnCamara = document.getElementById('btn-camara');
    const previewContainer = document.getElementById('preview-container');
    const imgPreview = document.getElementById('img-preview');
    const btnRemoveImg = document.getElementById('btn-remove-img');

    // Elementos del Selector Dinámico
    const modalMediaPicker = document.getElementById('modal-media-picker');
    const btnChooseCamera = document.getElementById('btn-choose-camera');
    const btnChooseGallery = document.getElementById('btn-choose-gallery');
    const btnCloseMediaModal = document.getElementById('btn-close-media-modal');
    const inputGaleria = document.getElementById('input-galeria');

    // Elementos de la cámara en vivo
    const modalCameraLive = document.getElementById('modal-camera-live');
    const videoCamera = document.getElementById('video-camera');
    const canvasCapture = document.getElementById('canvas-capture');
    const btnCapturePhoto = document.getElementById('btn-capture-photo');
    const btnCloseCamera = document.getElementById('btn-close-camera');

    // --- REFERENCIAS DEL GPS ---
    const btnLocation = document.getElementById('btn-location');
    const geoText = document.getElementById('geo-text');
    const geoSuccessIcon = document.getElementById('geo-success');
    const inputLat = document.getElementById('latitud');
    const inputLng = document.getElementById('longitud');

    // --- REFERENCIA DEL FORMULARIO ---
    const formReporte = document.getElementById('form-reporte');
    const btnEnviar = document.getElementById('btn-enviar');
    const selectTipoFalla = document.getElementById('tipo-falla');
    const textareaDescripcion = document.getElementById('descripcion');

    console.log({
    btnCamara,
    btnLocation,
    videoCamera,
    modalCameraLive
});

    let streamCamera = null; // Para detener la cámara
    let archivoFotoReporte = null; //  Archivo para subir a Storage

    // BORRADOR LOCAL DEL REPORTE (localStorage)
    // Guardamos  texto/ubicación no la foto, por límite de espacio de 5MB en localStorage. La foto se sube a Storage al enviar.

    const CLAVE_BORRADOR = 'fallocero_borrador_reporte';
    let timeoutGuardadoBorrador = null;

    function guardarBorrador() {
        try {
            const borrador = {
                tipoFalla: selectTipoFalla.value || '',
                descripcion: textareaDescripcion.value || '',
                latitud: inputLat.value || '',
                longitud: inputLng.value || '',
                geoTexto: geoText.innerText || '',
                guardadoEn: new Date().toISOString()
            };
            localStorage.setItem(CLAVE_BORRADOR, JSON.stringify(borrador));
        } catch (error) {
            console.error('No se pudo guardar el borrador local:', error);
        }
    }

    // Guarda con un pequeño retraso para no escribir en cada tecla
    function guardarBorradorConRetraso() {
        clearTimeout(timeoutGuardadoBorrador);
        timeoutGuardadoBorrador = setTimeout(guardarBorrador, 400);
    }

    function borrarBorrador() {
        localStorage.removeItem(CLAVE_BORRADOR);
    }

    function cargarBorrador() {
        try {
            const guardado = localStorage.getItem(CLAVE_BORRADOR);
            if (!guardado) return;

            const borrador = JSON.parse(guardado);

            let seRestauroAlgo = false;

            if (borrador.tipoFalla) {
                selectTipoFalla.value = borrador.tipoFalla;
                seRestauroAlgo = true;
            }

            if (borrador.descripcion) {
                textareaDescripcion.value = borrador.descripcion;
                seRestauroAlgo = true;
            }

            if (borrador.latitud && borrador.longitud) {
                inputLat.value = borrador.latitud;
                inputLng.value = borrador.longitud;
                geoText.innerText = borrador.geoTexto || `📍 ${borrador.latitud}, ${borrador.longitud}`;
                geoText.classList.add('success-text');
                geoSuccessIcon.classList.remove('hidden');
                seRestauroAlgo = true;
            }

            if (seRestauroAlgo) {
                mostrarToast('📝 Recuperamos un borrador que tenías sin enviar.', 'exito');
            }
        } catch (error) {
            console.error('No se pudo restaurar el borrador local:', error);
        }
    }

    // ================================================
    // FUNCIÓN PARA ABRIR LA CÁMARA EN VIVO
    // ================================================
    async function abrirCamaraVivo() {
        try {
            // Verificar si el navegador soporta getUserMedia
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                mostrarToast('⚠️ Tu navegador no soporta la cámara. Usa la galería.', 'error');
                return;
            }

            // Cerrar cualquier stream anterior
            if (streamCamera) {
                streamCamera.getTracks().forEach(track => track.stop());
                streamCamera = null;
            }

            // Usar la cámara trasera primero (environment), si no está disponible usar la frontal
            const constraints = {
                video: {
                    facingMode: { ideal: 'environment' },
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: false
            };

            // Intentar obtener la cámara
            streamCamera = await navigator.mediaDevices.getUserMedia(constraints);
            
            // Asignar el stream al elemento <video>
            videoCamera.srcObject = streamCamera;
            await videoCamera.play();

            // Mostrar el modal de la cámara
            modalCameraLive.classList.remove('hidden');
            
            mostrarToast('📷 Cámara activada. Apunta al problema.', 'exito');

        } catch (error) {
            console.error('Error al acceder a la cámara:', error);
            
            // Si falla, intentar con la cámara frontal
            if (error.name === 'OverconstrainedError' || error.name === 'NotReadableError') {
                try {
                    const constraintsFallback = {
                        video: {
                            facingMode: { ideal: 'user' },
                            width: { ideal: 1280 },
                            height: { ideal: 720 }
                        },
                        audio: false
                    };
                    
                    streamCamera = await navigator.mediaDevices.getUserMedia(constraintsFallback);
                    videoCamera.srcObject = streamCamera;
                    await videoCamera.play();
                    modalCameraLive.classList.remove('hidden');
                    mostrarToast('📷 Usando cámara frontal', 'exito');
                    return;
                } catch (fallbackError) {
                    console.error('Error con cámara frontal:', fallbackError);
                }
            }

            // Si todo falla, mostrar mensaje de error
            if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                mostrarToast('⚠️ Permiso de cámara denegado. Habilítalo en la configuración.', 'error');
            } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
                mostrarToast('📷 No se encontró ninguna cámara en tu dispositivo.', 'error');
            } else {
                mostrarToast('❌ No se pudo acceder a la cámara: ' + error.message, 'error');
            }
        }
    }

    // ================================================
    // FUNCIÓN PARA CERRAR LA CÁMARA
    // ================================================
    function cerrarCamara() {
        if (streamCamera) {
            streamCamera.getTracks().forEach(track => track.stop());
            streamCamera = null;
        }
        videoCamera.srcObject = null;
        modalCameraLive.classList.add('hidden');
    }

    // ================================================
    // FUNCIÓN PARA CAPTURAR FOTO DESDE EL VIDEO
    // ================================================
    async function capturarFoto() {
        if (!videoCamera.videoWidth || !videoCamera.videoHeight) {
            mostrarToast('⚠️ Espera a que la cámara se estabilice.', 'error');
            return;
        }

        try {
            // Configurar el canvas con las dimensiones del video
            canvasCapture.width = videoCamera.videoWidth;
            canvasCapture.height = videoCamera.videoHeight;
            
            const context = canvasCapture.getContext('2d');
            context.drawImage(videoCamera, 0, 0, canvasCapture.width, canvasCapture.height);
            
            // Convertir el canvas a Blob (mejor que Base64 para Storage)
            const blob = await new Promise(resolve => {
                canvasCapture.toBlob(resolve, 'image/jpeg', 0.85);
            });

            // Crear un archivo a partir del Blob
            const fileName = `foto_${Date.now()}.jpg`;
            const file = new File([blob], fileName, { type: 'image/jpeg' });
            
            // Guardar archivo para subir después
            archivoFotoReporte = file;
            
            // Vista previa en Base64
            const base64 = await fileToBase64(file);
            imgPreview.src = base64;
            previewContainer.classList.remove('hidden');
            btnCamara.classList.add('hidden');
            
            // Cerrar la cámara
            cerrarCamara();
            
            mostrarToast('📸 ¡Foto capturada correctamente!', 'exito');
            
        } catch (error) {
            console.error('Error al capturar foto:', error);
            mostrarToast('❌ Error al procesar la foto.', 'error');
        }
    }

    // ================================================
    // ABRIR GALERÍA CON MÉTODO TRADICIONAL
    // ================================================
    function abrirGaleria() {
        inputGaleria.value = '';
        inputGaleria.setAttribute('accept', 'image/*');
        inputGaleria.removeAttribute('capture');
        
        setTimeout(() => {
            inputGaleria.click();
        }, 100);
    }

    // ================================================
    // PROCESAR IMAGEN DESDE GALERÍA (CON STORAGE)
    // ================================================
    async function procesarArchivoImagen(file) {
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            mostrarToast('⚠️ Selecciona un archivo de imagen válido.', 'error');
            return;
        }

        if (file.size > 3 * 1024 * 1024) {
            mostrarToast('⚠️ La imagen es muy pesada. Máximo 3MB.', 'error');
            return;
        }

        try {
            // Guardar archivo para subir después
            archivoFotoReporte = file;
            
            // Vista previa en Base64
            const base64 = await fileToBase64(file);
            imgPreview.src = base64;
            previewContainer.classList.remove('hidden');
            btnCamara.classList.add('hidden');
            mostrarToast('🖼️ Imagen seleccionada correctamente', 'exito');
            
        } catch (error) {
            console.error('Error al procesar imagen:', error);
            mostrarToast('❌ Error al leer la imagen.', 'error');
        }
    }

    // ================================================
    // SISTEMA DE TOASTS
    // ================================================
    function mostrarToast(mensaje, tipo) {
        const toastsExistentes = document.querySelectorAll('.toast-alerta');
        toastsExistentes.forEach(t => t.remove());

        const toast = document.createElement('div');
        toast.className = 'toast-alerta';
        toast.innerHTML = `
            <i class='bx ${tipo === 'error' ? 'bx-error-circle' : 'bx-check-circle'}'></i>
            <span>${mensaje}</span>
        `;
        
        const colorFondo = tipo === 'error' ? '#fef2f2' : '#f0fdf4';
        const colorTexto = tipo === 'error' ? '#dc2626' : '#16a34a';
        const colorBorde = tipo === 'error' ? '#fecaca' : '#bbf7d0';
        
        toast.style.cssText = `
            position: fixed;
            bottom: 30px;
            left: 50%;
            transform: translateX(-50%);
            background: ${colorFondo};
            color: ${colorTexto};
            padding: 14px 24px;
            border-radius: 12px;
            font-size: 14px;
            font-weight: 600;
            box-shadow: 0 8px 24px rgba(0,0,0,0.15);
            z-index: 99999;
            display: flex;
            align-items: center;
            gap: 10px;
            border: 1px solid ${colorBorde};
            max-width: 90%;
            font-family: system-ui, -apple-system, sans-serif;
            animation: slideUpToast 0.3s ease-out;
        `;
        
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-50%) translateY(20px)';
            toast.style.transition = 'all 0.4s ease';
            setTimeout(() => toast.remove(), 400);
        }, 3500);
    }

    // ================================================
    // CONFIGURACIÓN DE EVENTOS
    // ================================================

    // 1. Abrir modal de selección
    btnCamara.addEventListener('click', () => {
        modalMediaPicker.classList.remove('hidden');
    });

    // 2. Cerrar modal de selección
    btnCloseMediaModal.addEventListener('click', () => {
        modalMediaPicker.classList.add('hidden');
    });

    // 3. Elegir cámara en vivo
    btnChooseCamera.addEventListener('click', () => {
        modalMediaPicker.classList.add('hidden');
        setTimeout(() => {
            abrirCamaraVivo();
        }, 300);
    });

    // 4. Elegir galería
    btnChooseGallery.addEventListener('click', () => {
        modalMediaPicker.classList.add('hidden');
        setTimeout(() => {
            abrirGaleria();
        }, 200);
    });

    // 5. Capturar foto
    btnCapturePhoto.addEventListener('click', capturarFoto);

    // 6. Cerrar cámara
    btnCloseCamera.addEventListener('click', cerrarCamara);

    // 7. Cerrar cámara haciendo clic fuera
    modalCameraLive.addEventListener('click', (e) => {
        if (e.target === modalCameraLive) {
            cerrarCamara();
        }
    });

    // 8. Procesar imagen de galería
    inputGaleria.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            procesarArchivoImagen(file);
        }
        inputGaleria.value = '';
    });

    // 9. Eliminar imagen
    btnRemoveImg.addEventListener('click', (e) => {
        e.stopPropagation();
        inputGaleria.value = '';
        imgPreview.src = '';
        archivoFotoReporte = null;
        previewContainer.classList.add('hidden');
        btnCamara.classList.remove('hidden');
    });

    //  Guardar borrador al cambiar tipo de anomalía o descripción
    selectTipoFalla.addEventListener('change', guardarBorrador);
    textareaDescripcion.addEventListener('input', guardarBorradorConRetraso);

    // ================================================
    // LÓGICA DE GEOLOCALIZACIÓN
    // ================================================
    btnLocation.addEventListener('click', () => {
        if (!navigator.geolocation) {
            geoText.innerText = "Tu dispositivo no soporta geolocalización.";
            mostrarToast('⚠️ Tu dispositivo no soporta GPS', 'error');
            return;
        }

        btnLocation.disabled = true;
        geoText.innerText = "Ubicando dispositivo...";
        geoText.classList.remove('success-text');

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;

                inputLat.value = lat;
                inputLng.value = lng;

                geoText.innerText = `📍 ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
                geoText.classList.add('success-text');
                geoSuccessIcon.classList.remove('hidden');
                btnLocation.disabled = false;
                mostrarToast('📍 Ubicación obtenida correctamente', 'exito');

                //Guardamos el borrador ya con la ubicación incluida
                guardarBorrador();
            },
            (error) => {
                btnLocation.disabled = false;
                geoSuccessIcon.classList.add('hidden');
                geoText.classList.remove('success-text');
                
                switch(error.code) {
                    case error.PERMISSION_DENIED:
                        geoText.innerText = "⚠️ Permiso de ubicación denegado";
                        mostrarToast('⚠️ Permite el acceso al GPS en tu dispositivo', 'error');
                        break;
                    case error.POSITION_UNAVAILABLE:
                        geoText.innerText = "📡 Señal GPS no disponible";
                        mostrarToast('📡 No se pudo obtener la señal GPS', 'error');
                        break;
                    case error.TIMEOUT:
                        geoText.innerText = "⏱️ Tiempo de espera agotado";
                        mostrarToast('⏱️ Tiempo de espera agotado', 'error');
                        break;
                    default:
                        geoText.innerText = "❌ Error de geolocalización";
                        mostrarToast('❌ Error al obtener ubicación', 'error');
                        break;
                }
            },
            {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 0
            }
        );
    });

    // ================================================
    // ENVÍO DEL REPORTE CON STORAGE
    // ================================================
    formReporte.addEventListener('submit', async (e) => {
        e.preventDefault();

        const user = auth.currentUser;
        if (!user) {
            mostrarToast('⚠️ Debes iniciar sesión para enviar un reporte', 'error');
            return;
        }

        const tipoFalla = document.getElementById('tipo-falla').value;
        const descripcion = document.getElementById('descripcion').value;
        const lat = inputLat.value;
        const lng = inputLng.value;

        if (!lat || !lng) {
            mostrarToast('⚠️ Obtén tu ubicación GPS antes de enviar', 'error');
            return;
        }

        if (!tipoFalla) {
            mostrarToast('⚠️ Selecciona un tipo de anomalía', 'error');
            return;
        }

        if (!descripcion || descripcion.trim().length < 10) {
            mostrarToast('⚠️ Describe la anomalía con más detalle (mínimo 10 caracteres)', 'error');
            return;
        }

        btnEnviar.disabled = true;
        btnEnviar.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> Subiendo reporte...";

        try {
            let fotoUrl = null;
            let fotoRef = null;

            // 🆕 Subir foto a Storage si existe
            if (archivoFotoReporte) {
                const uid = user.uid;
                const timestamp = Date.now();
                const nombreArchivo = `reporte_${timestamp}_${archivoFotoReporte.name}`;
                const ruta = generarRutaImagen('reportes', uid, nombreArchivo);
                
                fotoUrl = await subirImagen(archivoFotoReporte, ruta);
                fotoRef = ruta;
                
                console.log('📷 Foto subida a Storage:', fotoUrl);
            }

            // Crear objeto del reporte
            const nuevoReporteData = {
                idUsuario: user.uid,
                tipoAnomalia: tipoFalla,
                descripcion: descripcion.trim(),
                ubicacion: {
                    latitud: parseFloat(lat),
                    longitud: parseFloat(lng)
                },
                estado: "pendiente",
                fechaCreacion: new Date().toISOString()
            };

            // ✅ Guardar URL de Storage en lugar de Base64
            if (fotoUrl) {
                nuevoReporteData.fotos = [fotoUrl];
                nuevoReporteData.fotosRef = [fotoRef];
                // Mantener campo antiguo por compatibilidad
                nuevoReporteData.fotoUrl = fotoUrl;
            }

            const docRef = await addDoc(collection(db, "reportes"), nuevoReporteData);

            mostrarToast(`🎉 ¡Reporte enviado! Folio: ${docRef.id.substring(0,8)}`, 'exito');

            // 🆕 El reporte se envió con éxito: ya no hace falta el borrador
            borrarBorrador();
            
            // Limpieza completa
            formReporte.reset();
            inputGaleria.value = '';
            archivoFotoReporte = null;
            geoSuccessIcon.classList.add('hidden');
            geoText.innerText = "Ubicación no establecida";
            geoText.classList.remove('success-text');
            previewContainer.classList.add('hidden');
            btnCamara.classList.remove('hidden');
            document.getElementById('tipo-falla').value = '';

        } catch (error) {
            console.error("Error de Firestore: ", error);
            mostrarToast('❌ Error al enviar el reporte. Revisa tu conexión.', 'error');
        } finally {
            btnEnviar.disabled = false;
            btnEnviar.innerHTML = "<i class='bx bx-send'></i> Enviar Reporte";
        }
    });

    // ================================================
    // AÑADIR ESTILOS PARA LA CÁMARA
    // ================================================
    const styleCamera = document.createElement('style');
    styleCamera.textContent = `
        @keyframes slideUpToast {
            from { opacity: 0; transform: translateX(-50%) translateY(30px); }
            to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        .toast-alerta {
            font-family: system-ui, -apple-system, sans-serif;
            animation: slideUpToast 0.3s ease-out !important;
        }
        .toast-alerta i {
            font-size: 20px;
        }
        .location-status .success-text {
            color: #16a34a !important;
            font-weight: 600;
        }
        .location-status #geo-text {
            transition: color 0.3s ease;
        }
        
        /* Estilos para la cámara en vivo */
        .camera-modal-content {
            max-width: 500px;
            width: 100%;
        }
        .camera-modal-content .video-container {
            background: #000;
            border-radius: 12px;
            overflow: hidden;
            margin: 16px 0;
            position: relative;
            aspect-ratio: 4/3;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .camera-modal-content .video-container video {
            width: 100%;
            height: 100%;
            object-fit: cover;
            background: #1a1a1a;
        }
        .camera-modal-content .camera-actions {
            display: flex;
            gap: 12px;
            width: 100%;
        }
        .camera-modal-content .camera-actions .btn-primary {
            flex: 2;
        }
        .camera-modal-content .camera-actions .btn-modal-cancel {
            flex: 1;
            background: #f1f5f9;
            color: #475569;
            border: none;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            font-family: inherit;
        }
        .camera-modal-content .camera-actions .btn-modal-cancel:hover {
            background: #e2e8f0;
        }
        .camera-modal-content .camera-actions .btn-primary:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }
        
        @media (max-width: 480px) {
            .camera-modal-content {
                border-radius: 16px 16px 0 0 !important;
                padding: 20px !important;
            }
            .camera-modal-content .video-container {
                aspect-ratio: 4/3;
            }
        }
    `;
    document.head.appendChild(styleCamera);

    //   Al cargar la pantalla, intentamos restaurar un borrador previo
    cargarBorrador();

    console.log('📱 FalloCero - Módulo de reporte con cámara en vivo, Storage y borrador local cargado');
});