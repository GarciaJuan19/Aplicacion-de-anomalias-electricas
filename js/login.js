import { auth, db } from './firebase-config.js';
import { 
    signInWithEmailAndPassword,
    sendEmailVerification
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getMenuUrl, mostrarToast, esAppMovil, esLocalhost } from './utils.js';

// ==========================================
// 🆕 CLAVES PARA LOCALSTORAGE (RECORDAR USUARIO)
// ==========================================
const STORAGE_KEYS = {
    EMAIL: 'fallocero_email_recordado',
    PASSWORD: 'fallocero_password_recordada',
    RECORDAR: 'fallocero_recordar_usuario'
};

// ==========================================
// 🆕 FUNCIÓN: CARGAR CREDENCIALES GUARDADAS
// ==========================================
function cargarCredencialesGuardadas() {
    const emailGuardado = localStorage.getItem(STORAGE_KEYS.EMAIL);
    const passwordGuardada = localStorage.getItem(STORAGE_KEYS.PASSWORD);
    const recordarActivado = localStorage.getItem(STORAGE_KEYS.RECORDAR) === 'true';

    console.log('📦 Credenciales guardadas:', {
        email: emailGuardado ? '✅ Sí' : '❌ No',
        password: passwordGuardada ? '✅ Sí' : '❌ No',
        recordar: recordarActivado
    });

    // Buscar los inputs
    const emailInput = document.getElementById('login-email');
    const passwordInput = document.getElementById('login-password');
    const rememberCheckbox = document.getElementById('remember-me');

    if (emailInput && emailGuardado) {
        emailInput.value = emailGuardado;
        console.log('📧 Email cargado:', emailGuardado);
    }

    if (passwordInput && passwordGuardada && recordarActivado) {
        passwordInput.value = passwordGuardada;
        console.log('🔐 Contraseña cargada');
    }

    if (rememberCheckbox && recordarActivado) {
        rememberCheckbox.checked = true;
    }
}

// ==========================================
// 🆕 FUNCIÓN: GUARDAR CREDENCIALES
// ==========================================
function guardarCredenciales(email, password, recordar) {
    if (recordar) {
        localStorage.setItem(STORAGE_KEYS.EMAIL, email);
        localStorage.setItem(STORAGE_KEYS.PASSWORD, password);
        localStorage.setItem(STORAGE_KEYS.RECORDAR, 'true');
        console.log('💾 Credenciales guardadas');
    } else {
        localStorage.removeItem(STORAGE_KEYS.EMAIL);
        localStorage.removeItem(STORAGE_KEYS.PASSWORD);
        localStorage.removeItem(STORAGE_KEYS.RECORDAR);
        console.log('🗑️ Credenciales eliminadas');
    }
}

// 🔵 Asegura que los toasts (mostrarToast) siempre se vean por encima
// de cualquier modal, sin importar el orden en que se creen.
(() => {
    const estiloToastArriba = document.createElement('style');
    estiloToastArriba.textContent = `
        [class*="toast"], [id*="toast"] {
            z-index: 2147483647 !important;
        }
    `;
    document.head.appendChild(estiloToastArriba);
})();

// ==========================================
//  SPLASH SCREEN
// ==========================================
(() => {
    const splash = document.getElementById('splash-screen');
    if (splash) {
        setTimeout(() => {
            splash.classList.add('oculto');
            setTimeout(() => {
                splash.style.display = 'none';
            }, 600);
        }, 2500);
    }
})();

// ==========================================
//  LOGIN
// ==========================================
document.addEventListener('DOMContentLoaded', () => {

    console.log("📱 Plataforma:", esAppMovil() ? "APK/Móvil" : "Web");
    console.log("🌐 Localhost:", esLocalhost() ? "Sí" : "No");
    console.log("🔵 URL menú (redirección):", getMenuUrl());

    // ==========================================
    // 🆕 CARGAR CREDENCIALES AL INICIAR
    // ==========================================
    cargarCredencialesGuardadas();

    const formLogin = document.getElementById('form-login');
    const btnIniciar = document.getElementById('btn-iniciar');
    const passwordInput = document.getElementById('login-password');
    const togglePasswordBtn = document.getElementById('toggle-password');
    const rememberCheckbox = document.getElementById('remember-me');
    const emailInput = document.getElementById('login-email');

    if (togglePasswordBtn && passwordInput) {
        togglePasswordBtn.addEventListener('click', function () {
            const isPassword = passwordInput.getAttribute('type') === 'password';
            passwordInput.setAttribute('type', isPassword ? 'text' : 'password');
            this.classList.toggle('bx-hide');
            this.classList.toggle('bx-show');
        });
    }

    if (!formLogin) {
        console.error("No se encontró el formulario de Login en el HTML.");
        return;
    }

    // ==========================================
    //  FUNCIÓN: MOSTRAR MODAL DE VERIFICACIÓN
    //  ✅ Ahora usa clases CSS (auth.scss) en vez de estilos inline,
    //     así respeta modo claro/oscuro automáticamente.
    // ==========================================
    function mostrarModalReenvio(correo) {
        const overlayExistente = document.getElementById('modal-verificacion-overlay');
        if (overlayExistente) {
            overlayExistente.remove();
        }

        // ✅ Misma estructura y clases que el modal de registro.js
        // (modal-panel-overlay / modal-content / btn-modal-close),
        // así hereda automáticamente el modo oscuro/claro de auth.scss.
        const overlay = document.createElement('div');
        overlay.id = 'modal-verificacion-overlay';
        overlay.className = 'modal-panel-overlay active';

        overlay.innerHTML = `
            <div class="modal-content" style="text-align: center;">
                <div style="font-size: 48px; margin-bottom: 12px;">📧</div>
                <h3 class="modal-title" style="justify-content: center;">Verifica tu correo</h3>
                <div class="modal-body" style="margin-bottom: 20px; padding-right: 0;">
                    <p>
                        Te hemos enviado un enlace de verificación a <strong>${correo}</strong>.<br>
                        Revisa tu bandeja de entrada y carpeta de SPAM.
                    </p>
                </div>
                <div style="display: flex; flex-direction: column; gap: 10px; width: 100%;">
                    <button id="btn-verificar-ya" class="btn-modal-close" style="margin-top: 0; width: 100%;">
                        ✅ Ya verifiqué, iniciar sesión
                    </button>
                    <button id="btn-reenviar-verificacion" style="
                        background: var(--input-bg);
                        color: var(--text-primary);
                        border: 1px solid var(--card-border);
                        padding: 12px;
                        border-radius: 12px;
                        font-size: 14px;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.2s;
                    ">
                        🔄 Reenviar correo de verificación
                    </button>
                    <button id="btn-cerrar-modal-verif" style="
                        background: none;
                        border: none;
                        color: var(--text-secondary);
                        padding: 8px;
                        font-size: 13px;
                        cursor: pointer;
                        margin-top: 4px;
                    ">
                        Cerrar
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        document.getElementById('btn-cerrar-modal-verif').addEventListener('click', () => {
            overlay.remove();
        });

        document.getElementById('btn-verificar-ya').addEventListener('click', async () => {
            const user = auth.currentUser;
            if (user) {
                try {
                    await user.reload();
                    if (user.emailVerified) {
                        overlay.remove();
                        if (user.email === 'admin1@gmail.com' || user.email.endsWith('@admin.com')) {
                            window.location.href = 'admin/index.html';
                        } else {
                            window.location.href = 'menu.html';
                        }
                    } else {
                        mostrarToast('⚠️ Tu correo aún no ha sido verificado. Revisa tu bandeja de entrada.', 'error');
                    }
                } catch (error) {
                    mostrarToast('❌ Error al verificar: ' + error.message, 'error');
                }
            }
        });

        document.getElementById('btn-reenviar-verificacion').addEventListener('click', async () => {
            try {
                const user = auth.currentUser;
                if (user) {
                    await sendEmailVerification(user, {
                        url: getMenuUrl(),
                        handleCodeInApp: false
                    });
                    mostrarToast('✅ ¡Correo reenviado! Revisa tu bandeja de entrada y SPAM.', 'exito');
                }
            } catch (error) {
                mostrarToast('❌ Error al reenviar: ' + error.message, 'error');
            }
        });
    }

    // ==========================================
    //  FUNCIÓN: VERIFICAR SI EL USUARIO ES NUEVO
    // ==========================================
    async function esUsuarioNuevo(uid) {
        try {
            const userDocRef = doc(db, "usuarios", uid);
            const docSnap = await getDoc(userDocRef);
            
            if (!docSnap.exists()) {
                return false;
            }
            
            const data = docSnap.data();
            return data.email_verificado !== undefined && data.email_verificado === false;
            
        } catch (error) {
            console.error("Error al verificar usuario:", error);
            return false;
        }
    }

    // ==========================================
    //  SUBMIT DEL LOGIN (MODIFICADO)
    // ==========================================
    formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();

        const correo = emailInput ? emailInput.value.trim() : '';
        const contrasena = passwordInput ? passwordInput.value : '';
        const recordar = rememberCheckbox ? rememberCheckbox.checked : false;

        if (!correo || !contrasena) {
            mostrarToast('⚠️ Por favor, completa todos los campos.', 'error');
            return;
        }

        btnIniciar.disabled = true;
        btnIniciar.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> Verificando...";

        try {
            const userCredential = await signInWithEmailAndPassword(auth, correo, contrasena);
            const user = userCredential.user;

            await user.reload();

            // ==========================================
            // 🆕 GUARDAR O ELIMINAR CREDENCIALES
            // ==========================================
            guardarCredenciales(correo, contrasena, recordar);

            const nuevo = await esUsuarioNuevo(user.uid);

            if (nuevo && !user.emailVerified) {
                mostrarModalReenvio(correo);
                btnIniciar.disabled = false;
                btnIniciar.innerHTML = "<i class='bx bx-bolt'></i> Iniciar sesión";
                return;
            }

            if (user.email === 'admin1@gmail.com' || user.email.endsWith('@admin.com')) {
                window.location.href = 'admin/index.html';
            } else {
                window.location.href = 'menu.html';
            }

        } catch (error) {
            console.error("Error en Firebase Auth:", error.code);
            
            let mensaje = '❌ Error al iniciar sesión.';
            switch (error.code) {
                case 'auth/invalid-credential':
                case 'auth/wrong-password':
                case 'auth/user-not-found':
                    mensaje = '⚠️ El correo o la contraseña son incorrectos.';
                    break;
                case 'auth/too-many-requests':
                    mensaje = '⏱️ Demasiados intentos. Espera unos minutos.';
                    break;
                default:
                    mensaje = '❌ Error: ' + error.message;
                    break;
            }
            mostrarToast(mensaje, 'error');
            
            btnIniciar.disabled = false;
            btnIniciar.innerHTML = "<i class='bx bx-bolt'></i> Iniciar sesión";
        }
    });
});

   