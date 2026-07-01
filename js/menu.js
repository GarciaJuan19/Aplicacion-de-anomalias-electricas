import { auth, db } from './firebase-config.js';
import { 
    onAuthStateChanged, 
    signOut, 
    sendEmailVerification,
    applyActionCode
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getMenuUrl, mostrarToast } from './utils.js';

const txtDisplayName = document.getElementById('user-display-name');
const menuProfilePreview = document.getElementById('menu-profile-preview');
const menuAvatarIcon = document.getElementById('menu-avatar-icon');

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
            
            // Limpiar la URL
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
//  FUNCIÓN: MOSTRAR FOTO DE PERFIL O ÍCONO POR DEFECTO
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
//  🆕 FUNCIÓN: ESPERAR SESIÓN CON PROMESA
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
//  🆕 INICIALIZAR MENÚ CON ESPERA ACTIVA
// ==========================================
(async function initMenu() {
    console.log("🔵 Iniciando menú...");
    
    // 1. Procesar verificación si viene de la URL
    await procesarVerificacion();
    
    // 2. Esperar activamente la sesión (hasta 10 segundos)
    try {
        console.log("⏳ Esperando sesión de Firebase...");
        const user = await esperarSesion(10000);
        
        if (user) {
            console.log("✅ Sesión obtenida:", user.email);
            
            // Recargar para obtener estado actualizado
            await user.reload();
            
            // Verificar email
            if (!user.emailVerified) {
                mostrarAlertaVerificacion();
            }
            
            // Cargar datos
            await cargarDatosUsuario(user);
            
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
//  2. LÓGICA DEL BOTÓN CERRAR SESIÓN
// ==========================================
const btnLogout = document.getElementById('btn-logout');
if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
        if (confirm("¿Estás seguro de que deseas cerrar sesión?")) {
            try {
                await signOut(auth);
                window.location.href = 'login.html';
            } catch (error) {
                console.error("Error al cerrar sesión:", error);
                mostrarToast("No se pudo cerrar la sesión. Inténtalo de nuevo.", 'error');
            }
        }
    });
}