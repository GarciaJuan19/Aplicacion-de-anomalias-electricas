import { auth, db } from './firebase-config.js';
import { 
    signInWithEmailAndPassword,
    sendEmailVerification,
    GoogleAuthProvider,
    signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getMenuUrl, mostrarToast, esAppMovil, esLocalhost } from './utils.js';

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

    const formLogin = document.getElementById('form-login');
    const btnIniciar = document.getElementById('btn-iniciar');
    const passwordInput = document.getElementById('login-password');
    const togglePasswordBtn = document.getElementById('toggle-password');

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
    // ==========================================
    function mostrarModalReenvio(correo) {
        const overlayExistente = document.getElementById('modal-verificacion-overlay');
        if (overlayExistente) {
            overlayExistente.remove();
        }

        const overlay = document.createElement('div');
        overlay.id = 'modal-verificacion-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            backdrop-filter: blur(4px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 999999;
        `;

        overlay.innerHTML = `
            <div style="
                background: white;
                border-radius: 20px;
                padding: 32px 24px;
                max-width: 400px;
                width: 90%;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                text-align: center;
                position: relative;
            ">
                <div style="font-size: 48px; margin-bottom: 12px;">📧</div>
                <h3 style="margin: 0 0 8px 0; color: #1e293b; font-size: 20px;">Verifica tu correo</h3>
                <p style="margin: 0 0 20px 0; color: #64748b; font-size: 14px; line-height: 1.5;">
                    Te hemos enviado un enlace de verificación a <strong>${correo}</strong>.<br>
                    Revisa tu bandeja de entrada y carpeta de SPAM.
                </p>
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    <button id="btn-verificar-ya" style="
                        background: #0a46d1;
                        color: white;
                        border: none;
                        padding: 14px;
                        border-radius: 12px;
                        font-size: 15px;
                        font-weight: 600;
                        cursor: pointer;
                    ">
                        ✅ Ya verifiqué, iniciar sesión
                    </button>
                    <button id="btn-reenviar-verificacion" style="
                        background: #f1f5f9;
                        color: #475569;
                        border: none;
                        padding: 12px;
                        border-radius: 12px;
                        font-size: 14px;
                        font-weight: 600;
                        cursor: pointer;
                    ">
                        🔄 Reenviar correo de verificación
                    </button>
                    <button id="btn-cerrar-modal-verif" style="
                        background: none;
                        border: none;
                        color: #94a3b8;
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
                        url: getMenuUrl(),  // 🔵 AHORA REDIRIGE AL MENÚ
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
    //  LOGIN CON GOOGLE
    // ==========================================
    const btnGoogle = document.getElementById('btn-google');
    if (btnGoogle) {
        btnGoogle.addEventListener('click', async () => {
            const textoOriginal = btnGoogle.innerHTML;
            btnGoogle.disabled = true;
            btnGoogle.innerHTML = `<i class='bx bx-loader-alt bx-spin'></i> Conectando...`;

            try {
                const provider = new GoogleAuthProvider();
                const resultado = await signInWithPopup(auth, provider);
                const user = resultado.user;

                // Si es la primera vez que este usuario entra, creamos su perfil en Firestore
                const userDocRef = doc(db, "usuarios", user.uid);
                const docSnap = await getDoc(userDocRef);

                if (!docSnap.exists()) {
                    await setDoc(userDocRef, {
                        id_usuario: user.uid,
                        nombre_completo: user.displayName || "Ciudadano",
                        correo_electronico: user.email,
                        rol: "ciudadano",
                        fecha_registro: new Date().toISOString(),
                        email_verificado: true, // Google ya verifica el correo
                        plataforma: esAppMovil() ? 'apk' : 'web',
                        metodo_registro: 'google'
                    });
                }

                if (user.email === 'admin1@gmail.com' || user.email.endsWith('@admin.com')) {
                    window.location.href = 'admin/index.html';
                } else {
                    window.location.href = 'menu.html';
                }

            } catch (error) {
                console.error("❌ Error con Google Sign-In:", error.code, error.message);

                if (error.code === 'auth/account-exists-with-different-credential') {
                    mostrarToast('Ya existe una cuenta con este correo. Inicia sesión con tu contraseña.', 'error');
                } else if (error.code === 'auth/popup-closed-by-user') {
                    // El usuario cerró la ventana de Google, no mostramos error
                } else {
                    mostrarToast('❌ No se pudo iniciar sesión con Google. Inténtalo de nuevo.', 'error');
                }

                btnGoogle.disabled = false;
                btnGoogle.innerHTML = textoOriginal;
            }
        });
    }

    // ==========================================
    //  SUBMIT DEL LOGIN
    // ==========================================
    formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();

        const correo = formLogin.querySelector('input[type="email"]').value.trim();
        const contrasena = passwordInput ? passwordInput.value : '';

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