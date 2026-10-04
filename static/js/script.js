import { auth, db } from "/static/js/firebase-config.js";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, setPersistence, browserLocalPersistence, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { doc, setDoc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

// 1. Funciones globales de UI (Modales y Pestañas)
window.abrirModalAcceso = function() {
    const modal = document.getElementById('modal-acceso');
    if (modal) modal.style.display = 'flex';
}

window.cerrarModalAcceso = function() {
    const modal = document.getElementById('modal-acceso');
    if (modal) modal.style.display = 'none';
}

window.cambiarTab = function(tab) {
    const loginContainer = document.getElementById('form-login-container');
    const registroContainer = document.getElementById('form-registro-container');
    const btnLogin = document.getElementById('btn-tab-login');
    const btnRegistro = document.getElementById('btn-tab-registro');

    if (tab === 'login') {
        if (loginContainer) loginContainer.style.display = 'block';
        if (registroContainer) registroContainer.style.display = 'none';
        if (btnLogin) btnLogin.style.opacity = '1';
        if (btnRegistro) btnRegistro.style.opacity = '0.6';
    } else {
        if (loginContainer) loginContainer.style.display = 'none';
        if (registroContainer) registroContainer.style.display = 'block';
        if (btnLogin) btnLogin.style.opacity = '0.6';
        if (btnRegistro) btnRegistro.style.opacity = '1';
    }
}

// Configurar persistencia de sesión local en Firebase
if (typeof auth !== 'undefined' && typeof setPersistence !== 'undefined' && typeof browserLocalPersistence !== 'undefined') {
    window.firebasePersistenceReady = setPersistence(auth, browserLocalPersistence).catch((error) => { console.error("Error al configurar la persistencia de sesión:", error); throw error; });
}

// 2. Pintado instantáneo de la barra superior usando LocalStorage (Para que no parpadee al cambiar de página)
function aplicarBarraUsuarioInstantanea() {
    const usuarioGuardado = JSON.parse(localStorage.getItem('usuario_actual') || localStorage.getItem('user'));
    if (!usuarioGuardado || !auth.currentUser) return;

    const botonAcceso = document.getElementById('btn-nav-auth');
    if (botonAcceso) botonAcceso.style.display = 'none';

}

// Ejecutar de inmediato al cargar el script
aplicarBarraUsuarioInstantanea();
document.addEventListener("DOMContentLoaded", aplicarBarraUsuarioInstantanea);

// Sincronización en segundo plano con Firebase Auth
if (typeof auth !== 'undefined') {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            let datosUsuario = JSON.parse(localStorage.getItem('usuario_actual') || localStorage.getItem('user'));
            if (!datosUsuario || datosUsuario.uid !== user.uid) {
                try {
                    const docRef = doc(db, "usuarios", user.uid);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        datosUsuario = docSnap.data();
                        datosUsuario.uid = user.uid;
                        localStorage.setItem('usuario_actual', JSON.stringify(datosUsuario));
                    }
                } catch (err) {
                    console.warn("Error al sincronizar Firestore:", err);
                }
            }
            aplicarBarraUsuarioInstantanea();
        } else {
            localStorage.removeItem('usuario_actual');
            localStorage.removeItem('user');
        }
    });
}

// 3. Procesar Inicio de Sesión (Funcional con Firebase)
window.procesarLogin = async function(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    console.log("⚡ Procesando inicio de sesión...");

    const emailEl = document.getElementById('login-email') || document.querySelector('#form-login-container input[type="email"]');
    const passEl = document.getElementById('login-password') || document.querySelector('#form-login-container input[type="password"]');

    const email = emailEl ? emailEl.value.trim() : "";
    const pass = passEl ? passEl.value : "";

    if (!email || !pass) {
        Swal.fire({
            title: 'Faltan datos',
            text: 'Introduce tu correo y contraseña.',
            icon: 'warning',
            background: '#1b0a38',
            color: '#ffffff',
            confirmButtonColor: '#7c3aed'
        });
        return;
    }

    try {
        await window.firebasePersistenceReady;
        const userCredential = await signInWithEmailAndPassword(auth, email, pass);
        const user = userCredential.user;

        const docRef = doc(db, "usuarios", user.uid);
        const docSnap = await getDoc(docRef);
        let datosUsuario = {};
        
        if (docSnap.exists()) {
            datosUsuario = docSnap.data();
        } else {
            datosUsuario = { uid: user.uid, email: user.email, username: user.email.split('@')[0], nombre: user.email.split('@')[0], birriacoins: 100 };
            await setDoc(docRef, { ...datosUsuario, fechaCreacion: serverTimestamp() }, { merge: true });
        }
        datosUsuario.uid = user.uid;

        localStorage.setItem('usuario_actual', JSON.stringify(datosUsuario));
        localStorage.setItem('user', JSON.stringify(datosUsuario));
        localStorage.setItem('usuarioId', user.uid);

        const modalAcceso = document.getElementById('modal-acceso');
        if (modalAcceso) modalAcceso.style.display = 'none';

        Swal.fire({
            title: '¡Bienvenido de nuevo!',
            text: 'Has iniciado sesión correctamente.',
            icon: 'success',
            background: '#1b0a38',
            color: '#ffffff',
            confirmButtonColor: '#7c3aed',
            confirmButtonText: 'Ir a mi perfil',
            allowOutsideClick: false
        }).then(() => {
            window.location.href = '/perfil';
        });

    } catch (error) {
        console.error("Error en inicio de sesión:", error);
        Swal.fire({
            title: 'Error de acceso',
            text: 'Correo o contraseña incorrectos.',
            icon: 'error',
            background: '#1b0a38',
            color: '#ffffff',
            confirmButtonColor: '#ef4444'
        });
    }
};

window.ejecutarLoginUnico = window.procesarLogin;
window.ejecutarLogin = window.procesarLogin;

// Recuperación de contraseña mediante código temporal enviado por el servidor.
let temporizadorReenvioPassword = null;

function iniciarEsperaReenvioPassword(segundos = 60) {
    const button = document.getElementById('btn-reenviar-codigo-reset');
    if (!button) return;
    if (temporizadorReenvioPassword) clearInterval(temporizadorReenvioPassword);

    let restante = segundos;
    button.disabled = true;
    button.style.opacity = '0.6';
    button.textContent = `Reenviar código (${restante} s)`;
    temporizadorReenvioPassword = setInterval(() => {
        restante -= 1;
        if (restante <= 0) {
            clearInterval(temporizadorReenvioPassword);
            temporizadorReenvioPassword = null;
            button.disabled = false;
            button.style.opacity = '1';
            button.textContent = 'Reenviar código';
            return;
        }
        button.textContent = `Reenviar código (${restante} s)`;
    }, 1000);
}

function limpiarEsperaReenvioPassword() {
    if (temporizadorReenvioPassword) clearInterval(temporizadorReenvioPassword);
    temporizadorReenvioPassword = null;
    const button = document.getElementById('btn-reenviar-codigo-reset');
    if (button) {
        button.disabled = true;
        button.style.opacity = '0.6';
        button.textContent = 'Reenviar código (60 s)';
    }
}

window.abrirRecuperacionPassword = function() {
    const loginForm = document.getElementById('form-login');
    const heading = document.querySelector('#form-login-container > h2');
    const resetContainer = document.getElementById('password-reset-container');
    const resetEmail = document.getElementById('reset-email');
    const loginEmail = document.getElementById('login-email');
    const emailStep = document.getElementById('password-reset-email-step');
    const codeStep = document.getElementById('password-reset-code-step');
    const passwordStep = document.getElementById('password-reset-password-step');
    const message = document.getElementById('password-reset-message');

    if (!loginForm || !resetContainer) return;
    limpiarEsperaReenvioPassword();
    if (resetEmail && loginEmail) resetEmail.value = loginEmail.value.trim();
    loginForm.style.display = 'none';
    resetContainer.style.display = 'block';
    if (heading) heading.textContent = 'RECUPERA TU CUENTA';
    if (emailStep) emailStep.style.display = 'block';
    if (codeStep) codeStep.style.display = 'none';
    if (passwordStep) passwordStep.style.display = 'none';
    for (const id of ['reset-code', 'reset-new-password', 'reset-confirm-password']) {
        const input = document.getElementById(id);
        if (input) {
            input.value = '';
            if (id !== 'reset-code') input.type = 'password';
        }
    }
    if (message) message.style.display = 'none';
};

window.volverAlLoginDesdeReset = function() {
    const loginForm = document.getElementById('form-login');
    const heading = document.querySelector('#form-login-container > h2');
    const resetContainer = document.getElementById('password-reset-container');
    if (resetContainer) resetContainer.style.display = 'none';
    if (loginForm) loginForm.style.display = 'block';
    if (heading) heading.textContent = 'ACCESO A BIRRIAS';
};

function mostrarEstadoReset(texto, error = false) {
    const message = document.getElementById('password-reset-message');
    if (!message) return;
    message.textContent = texto;
    message.style.display = 'block';
    message.style.color = error ? '#fca5a5' : '#cbd5e1';
}

async function alertaPasswordReset(titulo, texto, icono = 'info') {
    if (typeof Swal !== 'undefined') {
        return Swal.fire({
            title: titulo,
            text: texto,
            icon: icono,
            background: '#1b0a38',
            color: '#ffffff',
            confirmButtonColor: icono === 'error' ? '#ef4444' : '#7c3aed',
            confirmButtonText: 'Continuar'
        });
    }
    window.alert(`${titulo}\n\n${texto}`);
}

window.solicitarCodigoPassword = async function(esReenvio = false) {
    const email = (document.getElementById('reset-email')?.value || '').trim().toLowerCase();
    const button = document.getElementById('btn-enviar-codigo-reset');
    const resendButton = document.getElementById('btn-reenviar-codigo-reset');
    const emailStep = document.getElementById('password-reset-email-step');
    const codeStep = document.getElementById('password-reset-code-step');
    if (!email) {
        mostrarEstadoReset('Escribe el correo electrónico de tu cuenta.', true);
        return alertaPasswordReset('Falta el correo', 'Escribe el correo electrónico de tu cuenta.', 'error');
    }

    if (button) button.disabled = true;
    if (esReenvio && resendButton) {
        resendButton.disabled = true;
        resendButton.textContent = 'Enviando…';
    }
    mostrarEstadoReset(esReenvio ? 'Enviando otro código…' : 'Enviando la solicitud…');
    try {
        const response = await fetch('/api/password-reset/request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        const result = await response.json();
        if (!response.ok || !result.success) {
            throw new Error(result.message || 'No se pudo enviar el código. Inténtalo más tarde.');
        }
        await alertaPasswordReset(esReenvio ? 'Solicitud reenviada' : 'Solicitud enviada', 'Si ese correo tiene una cuenta, recibirás un código de seis cifras. Revisa también la carpeta de spam.', 'success');
        if (emailStep) emailStep.style.display = 'none';
        if (codeStep) codeStep.style.display = 'block';
        iniciarEsperaReenvioPassword();
        const message = document.getElementById('password-reset-message');
        if (message) message.style.display = 'none';
    } catch (error) {
        mostrarEstadoReset(error.message || 'No se pudo enviar el código. Inténtalo más tarde.', true);
        await alertaPasswordReset('No se pudo enviar el código', error.message || 'Inténtalo de nuevo más tarde.', 'error');
        if (esReenvio && resendButton) {
            resendButton.disabled = false;
            resendButton.style.opacity = '1';
            resendButton.textContent = 'Reintentar envío';
        }
    } finally {
        if (button) button.disabled = false;
    }
};

window.reenviarCodigoPassword = function() {
    const button = document.getElementById('btn-reenviar-codigo-reset');
    if (button && !button.disabled) return window.solicitarCodigoPassword(true);
};

window.verificarCodigoPassword = async function() {
    const email = (document.getElementById('reset-email')?.value || '').trim().toLowerCase();
    const code = (document.getElementById('reset-code')?.value || '').trim();
    const button = document.getElementById('btn-confirmar-codigo-reset');
    const codeStep = document.getElementById('password-reset-code-step');
    const passwordStep = document.getElementById('password-reset-password-step');

    if (!/^\d{6}$/.test(code)) {
        mostrarEstadoReset('El código debe tener seis cifras.', true);
        return alertaPasswordReset('Código incompleto', 'Introduce las seis cifras que recibiste por correo.', 'error');
    }

    if (button) button.disabled = true;
    mostrarEstadoReset('Comprobando el código…');
    try {
        const response = await fetch('/api/password-reset/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, code })
        });
        const result = await response.json();
        if (!response.ok || !result.success) {
            throw new Error(result.message || 'El código no es válido o ha caducado.');
        }

        await alertaPasswordReset('Código confirmado', 'Ahora puedes crear y confirmar tu contraseña nueva.', 'success');
        if (codeStep) codeStep.style.display = 'none';
        if (passwordStep) passwordStep.style.display = 'block';
        const message = document.getElementById('password-reset-message');
        if (message) message.style.display = 'none';
    } catch (error) {
        mostrarEstadoReset(error.message || 'El código no es válido o ha caducado.', true);
        await alertaPasswordReset('No se pudo confirmar el código', error.message || 'Comprueba las cifras e inténtalo otra vez.', 'error');
    } finally {
        if (button) button.disabled = false;
    }
};

window.confirmarResetPassword = async function() {
    const email = (document.getElementById('reset-email')?.value || '').trim().toLowerCase();
    const code = (document.getElementById('reset-code')?.value || '').trim();
    const password = document.getElementById('reset-new-password')?.value || '';
    const confirmPassword = document.getElementById('reset-confirm-password')?.value || '';
    const button = document.getElementById('btn-guardar-password-reset');

    if (!/^\d{6}$/.test(code)) {
        mostrarEstadoReset('El código no es válido o ha caducado. Solicita uno nuevo.', true);
        return alertaPasswordReset('Código no válido', 'Vuelve atrás e introduce un código correcto o solicita otro.', 'error');
    }
    if (password.length < 8) {
        mostrarEstadoReset('La contraseña debe tener al menos 8 caracteres.', true);
        return alertaPasswordReset('Contraseña demasiado corta', 'La nueva contraseña debe tener al menos 8 caracteres.', 'error');
    }
    if (password !== confirmPassword) {
        mostrarEstadoReset('Las contraseñas no coinciden.', true);
        return alertaPasswordReset('Las contraseñas no coinciden', 'Escribe la misma contraseña en los dos campos.', 'error');
    }

    if (button) button.disabled = true;
    mostrarEstadoReset('Guardando la contraseña nueva…');
    try {
        const response = await fetch('/api/password-reset/confirm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, code, password, confirm_password: confirmPassword })
        });
        const result = await response.json();
        if (!response.ok || !result.success) {
            throw new Error(result.message || 'No se pudo cambiar la contraseña.');
        }

        const loginEmail = document.getElementById('login-email');
        const loginPassword = document.getElementById('login-password');
        if (loginEmail) loginEmail.value = email;
        if (loginPassword) loginPassword.value = '';
        for (const id of ['reset-code', 'reset-new-password', 'reset-confirm-password']) {
            const input = document.getElementById(id);
            if (input) input.value = '';
        }
        window.volverAlLoginDesdeReset();
        mostrarEstadoReset('');
        const message = document.getElementById('password-reset-message');
        if (message) message.style.display = 'none';
        await alertaPasswordReset(
            'Contraseña actualizada',
            result.notification_sent
                ? 'Ya puedes iniciar sesión con tu contraseña nueva. Te enviamos un aviso por correo.'
                : 'La contraseña cambió correctamente, pero no se pudo enviar el aviso por correo.',
            'success'
        );
    } catch (error) {
        mostrarEstadoReset(error.message || 'No se pudo cambiar la contraseña. Solicita un código nuevo.', true);
        await alertaPasswordReset('No se pudo guardar la contraseña', error.message || 'Solicita un código nuevo e inténtalo otra vez.', 'error');
    } finally {
        if (button) button.disabled = false;
    }
};

// 4. Procesar Registro (Sin bordes rojos molestos, limpio)
window.procesarRegistro = async function(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    console.log("⚡ Procesando registro limpio...");

    const usernameEl = document.getElementById('reg-usuario') || document.getElementById('unique-reg-username') || document.querySelector('#form-registro-container input[type="text"]');
    const nacionalidadEl = document.getElementById('reg-nacionalidad') || document.getElementById('unique-reg-nacionalidad') || document.querySelector('#form-registro-container select');
    const emailEl = document.getElementById('reg-email') || document.getElementById('unique-reg-email') || document.querySelector('#form-registro-container input[type="email"]');
    const nacimientoEl = document.getElementById('reg-nacimiento') || document.getElementById('unique-reg-nacimiento') || document.querySelector('#form-registro-container input[type="date"]');
    
    const inputsPassword = document.querySelectorAll('#form-registro-container input[type="password"], #registro-modal input[type="password"]');
    const passEl = document.getElementById('reg-pass') || inputsPassword[0];
    const passConfirmEl = document.getElementById('reg-pass-confirm') || inputsPassword[1];

    const username = usernameEl ? usernameEl.value.trim() : "";
    const nacionalidad = nacionalidadEl ? nacionalidadEl.value.trim() : "";
    const email = emailEl ? emailEl.value.trim() : "";
    const nacimiento = nacimientoEl ? nacimientoEl.value.trim() : "";
    const pass = passEl ? passEl.value : "";
    const passConfirm = passConfirmEl ? passConfirmEl.value : "";

    if (!username || !nacionalidad || !email || !pass) {
        Swal.fire({
            title: 'Faltan datos',
            text: 'Rellena los campos principales y selecciona tu nacionalidad para registrarte.',
            icon: 'warning',
            background: '#1b0a38',
            color: '#ffffff',
            confirmButtonColor: '#7c3aed'
        });
        return;
    }

    if (!nacimiento) {
        Swal.fire({
            title: 'Falta la fecha de nacimiento',
            text: 'Elige tu día, mes y año de nacimiento para continuar.',
            icon: 'warning',
            background: '#1b0a38',
            color: '#ffffff',
            confirmButtonColor: '#7c3aed'
        });
        return;
    }

    if (pass.length < 8) {
        Swal.fire({
            title: 'Contraseña demasiado corta',
            text: 'La contraseña debe tener al menos 8 caracteres.',
            icon: 'warning',
            background: '#1b0a38',
            color: '#ffffff',
            confirmButtonColor: '#7c3aed'
        });
        return;
    }

    if (pass !== passConfirm) {
        Swal.fire({
            title: 'Error',
            text: 'Las contraseñas no coinciden.',
            icon: 'error',
            background: '#1b0a38',
            color: '#ffffff',
            confirmButtonColor: '#ef4444'
        });
        return;
    }

    let uidGenerado;

    try {
        await window.firebasePersistenceReady;
        const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
        uidGenerado = userCredential.user.uid;

        await setDoc(doc(db, "usuarios", uidGenerado), {
            uid: uidGenerado,
            username: username,
            nombre: username,
            email: email,
            nacionalidad: nacionalidad,
            nacimiento: nacimiento,
            fechaNacimiento: nacimiento,
            birriacoins: 100,
            fechaCreacion: serverTimestamp()
        }, { merge: true });

    } catch (error) {
        if (error.code === 'auth/email-already-in-use') {
            // El correo ya pertenece a una cuenta: validar contraseña e iniciar sesión,
            // sin reiniciar monedas ni reemplazar los datos que ya tenga en Firestore.
            try {
                const credential = await signInWithEmailAndPassword(auth, email, pass);
                const user = credential.user;
                const userRef = doc(db, "usuarios", user.uid);
                const userSnap = await getDoc(userRef);
                const datosExistentes = userSnap.exists() ? userSnap.data() : {};
                const datosUsuario = {
                    ...datosExistentes,
                    uid: user.uid,
                    email: user.email || email,
                    username: datosExistentes.username || username,
                    nombre: datosExistentes.username || datosExistentes.nombre || username,
                    nacionalidad: datosExistentes.nacionalidad || nacionalidad,
                    nacimiento: datosExistentes.nacimiento || nacimiento,
                    fechaNacimiento: datosExistentes.fechaNacimiento || datosExistentes.nacimiento || nacimiento,
                    birriacoins: datosExistentes.birriacoins ?? 100
                };
                await setDoc(userRef, datosUsuario, { merge: true });
                localStorage.setItem('usuario_actual', JSON.stringify(datosUsuario));
                localStorage.setItem('user', JSON.stringify(datosUsuario));
                localStorage.setItem('usuarioId', user.uid);
                Swal.fire({ title: '¡Sesión iniciada!', text: 'Esta cuenta ya existía. Te llevo a tu perfil.', icon: 'success', background: '#1b0a38', color: '#ffffff', confirmButtonColor: '#7c3aed', allowOutsideClick: false }).then(() => { window.location.href = '/perfil'; });
                return;
            } catch (loginError) {
                console.warn("La cuenta ya existe, pero no se pudo iniciar sesión:", loginError);
                const mensaje = loginError.code === 'auth/invalid-credential' || loginError.code === 'auth/wrong-password'
                    ? 'Ese correo ya tiene cuenta. Comprueba la contraseña o inicia sesión desde la pestaña correspondiente.'
                    : (loginError.message || 'No se pudo acceder a la cuenta. Comprueba la conexión.');
                Swal.fire({ title: 'Esta cuenta ya existe', text: mensaje, icon: 'warning', background: '#1b0a38', color: '#ffffff', confirmButtonColor: '#f59e0b' });
                return;
            }
        }

        console.error("Error en registro Firebase:", error);
        const mensaje = error.code === 'auth/network-request-failed'
            ? 'No se pudo conectar con Firebase. Comprueba la conexión y vuelve a intentarlo.'
            : (error.message || 'Comprueba los datos e inténtalo de nuevo.');
        Swal.fire({ title: 'No se pudo completar el registro', text: mensaje, icon: 'error', background: '#1b0a38', color: '#ffffff', confirmButtonColor: '#ef4444' });
        return;
    }

    const datosNuevos = {
        uid: uidGenerado,
        username: username,
        nombre: username,
        email: email,
        nacionalidad: nacionalidad,
        nacimiento: nacimiento,
        fechaNacimiento: nacimiento,
        birriacoins: 100
    };

    localStorage.setItem('usuario_actual', JSON.stringify(datosNuevos));
    localStorage.setItem('user', JSON.stringify(datosNuevos));
    localStorage.setItem('usuarioId', uidGenerado);

    const modalAcceso = document.getElementById('modal-acceso');
    if (modalAcceso) modalAcceso.style.display = 'none';

    Swal.fire({
        title: '¡Cuenta creada con éxito!',
        text: '¡Bienvenido a Birrias! Se han añadido 100 Birriacoins a tu cuenta.',
        icon: 'success',
        background: '#1b0a38',
        color: '#ffffff',
        confirmButtonColor: '#7c3aed',
        confirmButtonText: 'Ir a mi perfil',
        allowOutsideClick: false
    }).then(() => {
        window.location.href = '/perfil';
    });
};

window.ejecutarRegistroUnico = window.procesarRegistro;
window.ejecutarRegistro = window.procesarRegistro;


// --- SOLUCIÓN DEFINITIVA DE PERSISTENCIA DE SESIÓN ---

function verificarSesionLocalInstantanea() {
    const usuarioGuardado = JSON.parse(localStorage.getItem('usuario_actual') || localStorage.getItem('user'));
    
    if (usuarioGuardado && auth.currentUser) {
        const headerContainer = document.querySelector('header') || document.querySelector('.navbar') || document.body;
        if (!headerContainer) return;

        const botonAcceso = headerContainer.querySelector('#btn-nav-auth');
        if (botonAcceso) botonAcceso.style.display = 'none';

    }
}

// Ejecutar de inmediato y al cargar el DOM en cualquier página
verificarSesionLocalInstantanea();
document.addEventListener("DOMContentLoaded", verificarSesionLocalInstantanea);


// Conectar los botones del modal que no traen un onclick en el HTML.
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('#btn-ejecutar-login').forEach(button => {
        if (!button.hasAttribute('onclick')) button.addEventListener('click', window.procesarLogin);
    });
    document.querySelectorAll('#btn-ejecutar-registro').forEach(button => {
        if (!button.hasAttribute('onclick')) button.addEventListener('click', window.procesarRegistro);
    });
});
