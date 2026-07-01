import { auth, db } from './firebase-config.js';
import { 
    createUserWithEmailAndPassword,
    sendEmailVerification
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getBaseUrl, getMenuUrl, mostrarToast, esAppMovil, esLocalhost } from './utils.js';

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

document.addEventListener('DOMContentLoaded', () => {
    const formularioRegistro = document.getElementById('form-registro');
    const inputNombre = document.getElementById('reg-nombre');
    const inputCorreo = document.getElementById('reg-correo');
    const inputPassword = document.getElementById('reg-password');
    const inputConfirmar = document.getElementById('reg-confirmar');
    const chkTerminos = document.getElementById('reg-terminos');
    const btnRegistrar = document.getElementById('btn-registrar');
    const btnVerPassword = document.getElementById('toggle-reg-password');
    const btnVerConfirmar = document.getElementById('toggle-reg-confirmar');

    console.log("📱 Plataforma:", esAppMovil() ? "APK/Móvil" : "Web");
    console.log("🌐 Localhost:", esLocalhost() ? "Sí" : "No");
    console.log("🔵 URL base:", getBaseUrl());
    console.log("🔵 URL menú (redirección post-verificación):", getMenuUrl());

    if (btnVerPassword && inputPassword) {
        btnVerPassword.addEventListener('click', () => {
            const tipoActual = inputPassword.getAttribute('type') === 'password' ? 'text' : 'password';
            inputPassword.setAttribute('type', tipoActual);

            const icono = btnVerPassword.querySelector('i');
            if (icono) {
                if (tipoActual === 'text') {
                    icono.className = 'bx bx-hide';
                } else {
                    icono.className = 'bx bx-show';
                }
            }
        });
    }

    if (btnVerConfirmar && inputConfirmar) {
        btnVerConfirmar.addEventListener('click', () => {
            const tipoActual = inputConfirmar.getAttribute('type') === 'password' ? 'text' : 'password';
            inputConfirmar.setAttribute('type', tipoActual);

            const icono = btnVerConfirmar.querySelector('i');
            if (icono) {
                if (tipoActual === 'text') {
                    icono.className = 'bx bx-hide';
                } else {
                    icono.className = 'bx bx-show';
                }
            }
        });
    }

    // ==========================================
    //  FUNCIÓN: MODAL POST-REGISTRO (VERIFICACIÓN)
    // ==========================================
    function mostrarModalVerificacionRegistro(correo, uid) {
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
                <h3 style="margin: 0 0 8px 0; color: #1e293b; font-size: 20px;">¡Cuenta creada!</h3>
                <p style="margin: 0 0 20px 0; color: #64748b; font-size: 14px; line-height: 1.5;">
                    Te hemos enviado un enlace de verificación a <strong>${correo}</strong>.<br>
                    Ábrelo y luego vuelve aquí para continuar.
                </p>
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    <button id="btn-ya-verifique-registro" style="
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
                    <button id="btn-reenviar-registro" style="
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
                    <button id="btn-ir-login-registro" style="
                        background: none;
                        border: none;
                        color: #94a3b8;
                        padding: 8px;
                        font-size: 13px;
                        cursor: pointer;
                        margin-top: 4px;
                    ">
                        Ir a iniciar sesión manualmente
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        // Botón: ya verifiqué -> recargar usuario actual y entrar directo al menú
        document.getElementById('btn-ya-verifique-registro').addEventListener('click', async (e) => {
            const boton = e.currentTarget;
            const textoOriginal = boton.innerHTML;
            boton.disabled = true;
            boton.innerHTML = `<i class='bx bx-loader-alt bx-spin'></i> Verificando...`;

            try {
                const usuarioActual = auth.currentUser;

                if (!usuarioActual) {
                    // Por si la sesión se perdió (ej. cerró la pestaña), lo mandamos a login
                    mostrarToast('Tu sesión expiró, inicia sesión manualmente.', 'error');
                    window.location.href = 'login.html';
                    return;
                }

                await usuarioActual.reload();

                if (usuarioActual.emailVerified) {
                    // Actualizamos el estado en Firestore
                    try {
                        await updateDoc(doc(db, "usuarios", usuarioActual.uid), {
                            email_verificado: true
                        });
                    } catch (errUpdate) {
                        console.error("No se pudo actualizar email_verificado:", errUpdate);
                    }

                    mostrarToast('✅ ¡Correo verificado! Entrando...', 'exito');

                    if (usuarioActual.email === 'admin1@gmail.com' || usuarioActual.email.endsWith('@admin.com')) {
                        window.location.href = 'admin/index.html';
                    } else {
                        window.location.href = 'menu.html';
                    }
                } else {
                    mostrarToast('⚠️ Aún no detectamos la verificación. Revisa tu correo (y SPAM) e inténtalo de nuevo.', 'error');
                    boton.disabled = false;
                    boton.innerHTML = textoOriginal;
                }
            } catch (error) {
                console.error("❌ Error al verificar:", error);
                mostrarToast('❌ Ocurrió un error al verificar. Inténtalo de nuevo.', 'error');
                boton.disabled = false;
                boton.innerHTML = textoOriginal;
            }
        });

        // Botón: reenviar correo de verificación
        document.getElementById('btn-reenviar-registro').addEventListener('click', async (e) => {
            const boton = e.currentTarget;
            const textoOriginal = boton.innerHTML;
            boton.disabled = true;
            boton.innerHTML = `<i class='bx bx-loader-alt bx-spin'></i> Enviando...`;

            try {
                const usuarioActual = auth.currentUser;
                if (usuarioActual) {
                    await sendEmailVerification(usuarioActual, {
                        url: getMenuUrl(),
                        handleCodeInApp: false
                    });
                    mostrarToast('✅ ¡Correo reenviado! Revisa tu bandeja de entrada y SPAM.', 'exito');
                } else {
                    mostrarToast('Tu sesión expiró, inicia sesión manualmente.', 'error');
                }
            } catch (error) {
                console.error("❌ Error al reenviar:", error);
                mostrarToast('❌ Error al reenviar: ' + error.message, 'error');
            } finally {
                boton.disabled = false;
                boton.innerHTML = textoOriginal;
            }
        });

        // Botón: ir a login manualmente
        document.getElementById('btn-ir-login-registro').addEventListener('click', () => {
            window.location.href = 'login.html';
        });
    }

    if (formularioRegistro) {
        formularioRegistro.addEventListener('submit', async (e) => {
            e.preventDefault();

            const nombre = inputNombre.value.trim();
            const correo = inputCorreo.value.trim();
            const password = inputPassword.value;
            const confirmar = inputConfirmar.value;

            if (!nombre || !correo || !password || !confirmar) {
                mostrarToast('Por favor, rellena todos los campos obligatorios.', 'error');
                return;
            }

            if (!chkTerminos.checked) {
                mostrarToast('Es necesario aceptar los términos y condiciones de uso.', 'error');
                return;
            }

            if (password !== confirmar) {
                mostrarToast('Las contraseñas ingresadas no coinciden.', 'error');
                inputConfirmar.focus();
                return;
            }

            const regexPassword = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/;
            if (!regexPassword.test(password)) {
                mostrarToast('La contraseña debe tener un mínimo de 8 caracteres e incluir letras y números.', 'error');
                inputPassword.focus();
                return;
            }

            try {
                btnRegistrar.disabled = true;
                btnRegistrar.innerHTML = `<i class='bx bx-loader-alt bx-spin'></i> Creando cuenta...`;

                const credencialUsuario = await createUserWithEmailAndPassword(auth, correo, password);
                const usuario = credencialUsuario.user;
                console.log("✅ Cuenta creada en Auth. UID:", usuario.uid);

                // 🔵 ENVIAR CORREO CON REDIRECCIÓN AL MENÚ
                try {
                    const menuUrl = getMenuUrl();
                    console.log("📧 Enviando verificación a:", correo);
                    console.log("🔗 Redirigirá a:", menuUrl);
                    
                    await sendEmailVerification(usuario);
                    console.log("✅ Correo de verificación enviado con éxito");
                } catch (emailError) {
                    console.error("❌ Error al enviar correo:", emailError);
                }

                await setDoc(doc(db, "usuarios", usuario.uid), {
                    id_usuario: usuario.uid,
                    nombre_completo: nombre,
                    correo_electronico: correo,
                    rol: "ciudadano",
                    fecha_registro: new Date().toISOString(),
                    email_verificado: false,
                    plataforma: esAppMovil() ? 'apk' : 'web'
                });

                console.log("✅ Perfil guardado en Firestore");

                mostrarToast(
                    '✅ ¡Registro exitoso! Te hemos enviado un correo de verificación.',
                    'exito'
                );

                formularioRegistro.reset();
                btnRegistrar.disabled = false;
                btnRegistrar.innerHTML = `Registrar Cuenta`;

                // 🔵 En vez de redirigir a login.html, mostramos el modal
                // con el botón para verificar e iniciar sesión directo al menú.
                mostrarModalVerificacionRegistro(correo, usuario.uid);

            } catch (error) {
                console.error("❌ Error en registro:", error.code, error.message);
                btnRegistrar.disabled = false;
                btnRegistrar.innerHTML = `Registrar Cuenta`;

                switch (error.code) {
                    case 'auth/email-already-in-use':
                        mostrarToast('Este correo electrónico ya se encuentra registrado.', 'error');
                        inputCorreo.focus();
                        break;
                    case 'auth/invalid-email':
                        mostrarToast('El formato del correo electrónico ingresado no es válido.', 'error');
                        inputCorreo.focus();
                        break;
                    case 'auth/weak-password':
                        mostrarToast('La contraseña proporcionada es demasiado débil.', 'error');
                        inputPassword.focus();
                        break;
                    default:
                        mostrarToast('No se pudo completar el registro. Inténtalo de nuevo más tarde.', 'error');
                        break;
                }
            }
        });
    }
});