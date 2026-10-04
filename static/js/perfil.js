import { auth, db } from "/static/js/firebase-config.js";
import { doc, getDoc, updateDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged, EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

let streamerActivoGlobal = false;
let datosUsuarioCache = { username: "Usuario", email: "correo@domain.com" };

// 1. Funciones globales de apertura y cierre del modal de avatar
window.abrirModalAvatar = function() {
    const modal = document.getElementById('modal-avatar');
    if (modal) modal.style.display = 'flex';
};

window.cerrarModalAvatar = function() {
    const modal = document.getElementById('modal-avatar');
    if (modal) modal.style.display = 'none';
};

window.seleccionarBrawlerAvatar = function(nombreArchivo) {
    window.cerrarModalAvatar();
    const rutaImagen = `/static/images/${nombreArchivo}`;
    actualizarVistaAvatarLocal(rutaImagen);
};

window.subirAvatarArchivo = function(event) {
    const archivo = event.target.files[0];
    if (archivo) {
        window.cerrarModalAvatar();
        const lector = new FileReader();
        lector.onload = function(e) {
            actualizarVistaAvatarLocal(e.target.result);
        };
        lector.readAsDataURL(archivo);
    }
};

// 2. Sincronizador universal unificado
function aplicarDatosEnPantalla(data) {
    if (!data) return;

    const totalMonedas = data.birriacoins ?? data.monedas ?? data.coins ?? 100;
    ['coins-amount', 'coins-amount-profile'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerText = totalMonedas;
    });

    let emailUserPart = data.email ? data.email.split('@')[0] : "usuario";
    let nombreReal = (!data.nombre || data.nombre === "Sin nombre" || data.nombre === "Usuario") ? emailUserPart : data.nombre;
    let apellidoReal = (!data.apellido || data.apellido === "Sin apellido") ? "" : data.apellido;
    let usernameReal = (!data.username || data.username === "usuario") ? emailUserPart : data.username;
    
    const emailReal = data.email || "correo@desconocido.com";
    const fnacimientoReal = data.fechaNacimiento || data.fnacimiento || data.birthdate || "";
    const nacionalidadReal = data.nacionalidad || "España";

    if (document.getElementById('nombre-usuario-display')) document.getElementById('nombre-usuario-display').innerText = usernameReal;
    if (document.getElementById('user-name-left-full')) document.getElementById('user-name-left-full').innerText = `${nombreReal} ${apellidoReal}`.trim();
    if (document.getElementById('username-preview-left')) document.getElementById('username-preview-left').innerText = "@" + usernameReal;
    if (document.getElementById('user-email-left-full')) document.getElementById('user-email-left-full').innerText = emailReal;

    if (document.getElementById('input-perfil-nombre')) document.getElementById('input-perfil-nombre').value = nombreReal;
    if (document.getElementById('input-perfil-apellido')) document.getElementById('input-perfil-apellido').value = apellidoReal;
    if (document.getElementById('input-perfil-username')) document.getElementById('input-perfil-username').value = usernameReal;
    if (document.getElementById('input-perfil-nacionalidad')) document.getElementById('input-perfil-nacionalidad').value = nacionalidadReal;
    
    // Asignación directa al input de fecha como texto
    const inputFecha = document.getElementById('input-perfil-fnacimiento') || document.querySelector('input[placeholder*="dd/mm"]') || document.getElementById('fechaNacimiento');
    if (inputFecha) {
        inputFecha.value = fnacimientoReal;
    }

    if (document.getElementById('perfil-email')) document.getElementById('perfil-email').innerText = emailReal;

    if (data.avatar) {
        actualizarVistaAvatarLocal(data.avatar);
    }
}

window.guardarCambiosPerfil = async function() {
    // 1. Recogemos los valores de los inputs de forma segura
    const inputNombre = document.getElementById('nombre') || document.getElementById('input-perfil-nombre');
    const inputApellido = document.getElementById('apellido') || document.getElementById('input-perfil-apellido');
    const inputUsername = document.getElementById('username-input') || document.getElementById('input-perfil-username');
    const inputNacionalidad = document.getElementById('nacionalidad') || document.getElementById('input-perfil-nacionalidad');
    
    // Aquí apuntamos directamente a tu ID exacto del HTML: 'input-perfil-fnacimiento'
    const inputNacimiento = document.getElementById('input-perfil-fnacimiento') || document.getElementById('fechaNacimiento') || document.querySelector('input[placeholder*="dd/mm"]');

    const nuevoNombre = inputNombre ? inputNombre.value.trim() : "";
    const nuevoApellido = inputApellido ? inputApellido.value.trim() : "";
    const nuevoUsername = inputUsername ? inputUsername.value.trim() : "";
    const nuevaNacionalidad = inputNacionalidad ? inputNacionalidad.value.trim() : "";
    const nuevaFnacimiento = inputNacimiento ? inputNacimiento.value.trim() : "";

    // 2. Actualizamos el almacenamiento local (LocalStorage)
    let usuarioLogueado = JSON.parse(localStorage.getItem('usuario_actual') || localStorage.getItem('user')) || {};            
    usuarioLogueado.nombre = nuevoNombre;
    usuarioLogueado.apellido = nuevoApellido;
    usuarioLogueado.username = nuevoUsername;
    usuarioLogueado.nacionalidad = nuevaNacionalidad;
    usuarioLogueado.nacimiento = nuevaFnacimiento;       // Guardado con ambas claves por compatibilidad
    usuarioLogueado.fechaNacimiento = nuevaFnacimiento;  

    localStorage.setItem('usuario_actual', JSON.stringify(usuarioLogueado));
    localStorage.setItem('user', JSON.stringify(usuarioLogueado));

    // 3. Refrescamos la interfaz al instante
    if (typeof aplicarDatosEnPantalla === 'function') {
        aplicarDatosEnPantalla(usuarioLogueado);
    }

    // 4. Guardamos en Firebase con merge: true para que cree el campo si no existía antes
    const userAuth = window.auth?.currentUser;
    if (userAuth) {
        try {
            await setDoc(doc(window.db, 'usuarios', userAuth.uid), {
                nombre: nuevoNombre,
                apellido: nuevoApellido,
                username: nuevoUsername,
                nacionalidad: nuevaNacionalidad,
                nacimiento: nuevaFnacimiento,
                fechaNacimiento: nuevaFnacimiento
            }, { merge: true });
            
            console.log("✅ Fecha y datos guardados en la nube con éxito.");
            mostrarMensajeGuardado("¡Cambios guardados correctamente!", "#22c55e");
        } catch (err) {
            console.error("❌ Error en Firestore:", err);
            mostrarMensajeGuardado("Guardado localmente (Error en la nube)", "#f59e0b");
        }
    } else {
        mostrarMensajeGuardado("¡Cambios guardados localmente!", "#22c55e");
    }
};

function mostrarMensajeGuardado(texto, color) {
    const msg = document.getElementById('mensaje-guardado-perfil');
    if (msg) {
        msg.innerText = texto;
        msg.style.color = color;
        msg.style.display = 'block';
        setTimeout(() => { msg.style.display = 'none'; }, 4000);
    }
}
function actualizarVistaAvatarLocal(url) {
    const imgPerfil = document.getElementById('img-avatar-perfil');
    const placeholderPerfil = document.getElementById('avatar-placeholder-perfil');
    const imgNavbar = document.getElementById('avatar-usuario');
    const textoNavbar = document.getElementById('avatar-inicial-texto');

    if (url) {
        if (imgPerfil) { imgPerfil.src = url; imgPerfil.style.display = 'block'; }
        if (placeholderPerfil) { placeholderPerfil.style.display = 'none'; }
        if (imgNavbar) { imgNavbar.src = url; imgNavbar.style.display = 'block'; }
        if (textoNavbar) { textoNavbar.style.display = 'none'; }
    }
}

// --- PARCHE GLOBAL PREVENTIVO ---
window.usuarioLogueado = JSON.parse(localStorage.getItem('usuario_actual') || localStorage.getItem('user')) || {};
window.aplicarEfectoModoStreamer = function(forzarEstado, dataUser) {
    if (typeof window.toggleModoStreamer === 'function') {
        window.toggleModoStreamer(forzarEstado, dataUser);
    }
};

// --- MÓDULO MODO STREAMER ---
window.toggleModoStreamer = function(forzarEstado, dataUser) {
    const checkboxStreamer = document.getElementById('btn-modo-streamer') || document.querySelector('input[type="checkbox"]');
    let activo = forzarEstado !== undefined ? forzarEstado : (checkboxStreamer ? checkboxStreamer.checked : false);

    aplicarModoStreamerUI(activo, dataUser);

    let localUser = JSON.parse(localStorage.getItem('usuario_actual') || localStorage.getItem('user')) || {};
    localUser.modoStreamer = activo;
    localStorage.setItem('usuario_actual', JSON.stringify(localUser));
    localStorage.setItem('user', JSON.stringify(localUser));
    window.usuarioLogueado = localUser;

    const userAuth = auth.currentUser;
    if (userAuth) {
        updateDoc(doc(db, 'usuarios', userAuth.uid), { modoStreamer: activo })
            .catch(error => console.error("Error al guardar modo streamer:", error));
    }
};

function aplicarModoStreamerUI(activo, dataUser) {
    const streamerActivo = !!activo;
    const checkboxStreamer = document.getElementById('btn-modo-streamer') || document.querySelector('input[type="checkbox"]');
    if (checkboxStreamer && checkboxStreamer.type === 'checkbox') {
        checkboxStreamer.checked = streamerActivo;
    }

    const todosLosInputs = document.querySelectorAll('input[type="text"], input[type="email"], input[type="date"], input:not([type="checkbox"]):not([type="radio"])');
    const todosLosTextos = document.querySelectorAll(`
        #nombre-usuario-display, #username-preview-left, #fullname-preview-left, 
        #email-usuario-display, [id*="nombre"], [id*="email"], [id*="user"], 
        [id*="perfil-"], .user-name, .user-email, .perfil-text
    `);

    const navbarUserBadge = document.querySelector('.user-badge-nav, .nav-user-container') || document.querySelector('div[style*="border-radius"]');
    const dot = document.getElementById('streamer-dot');
    const textoBtn = document.getElementById('btn-streamer-text');
    const estadoStreamerBox = document.getElementById('estado-streamer-info');

    if (streamerActivo) {
        todosLosTextos.forEach(el => {
            if (el && el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') {
                if (!el.dataset.originalText) el.dataset.originalText = el.innerText;
                el.innerText = "••••••••";
            }
        });
        todosLosInputs.forEach(input => {
            if (input && input.type !== 'checkbox' && input.type !== 'radio') {
                if (!input.dataset.originalVal) input.dataset.originalVal = input.value;
                input.value = "••••••••";
            }
        });
        if (navbarUserBadge) navbarUserBadge.style.visibility = 'hidden';
        if (dot) { dot.style.backgroundColor = '#22c55e'; dot.style.boxShadow = '0 0 8px #22c55e'; }
        if (textoBtn) textoBtn.innerText = 'MODO STREAMER: ENCENDIDO';
        if (estadoStreamerBox) estadoStreamerBox.style.display = 'block';
    } else {
        todosLosTextos.forEach(el => {
            if (el && el.dataset.originalText) el.innerText = el.dataset.originalText;
        });
        todosLosInputs.forEach(input => {
            if (input && input.dataset.originalVal) input.value = input.dataset.originalVal;
        });
        if (dataUser && typeof aplicarDatosEnPantalla === 'function') {
            aplicarDatosEnPantalla(dataUser);
        }
        if (navbarUserBadge) navbarUserBadge.style.visibility = 'visible';
        if (dot) { dot.style.backgroundColor = '#ef4444'; dot.style.boxShadow = '0 0 8px #ef4444'; }
        if (textoBtn) textoBtn.innerText = 'MODO STREAMER: APAGADO';
        if (estadoStreamerBox) estadoStreamerBox.style.display = 'none';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const checkboxStreamer = document.getElementById('btn-modo-streamer') || document.querySelector('input[type="checkbox"]');
    if (checkboxStreamer) {
        checkboxStreamer.addEventListener('change', (e) => {
            let usuarioActual = JSON.parse(localStorage.getItem('usuario_actual') || localStorage.getItem('user')) || {};
            window.toggleModoStreamer(e.target.checked, usuarioActual);
        });
    }
});

// 4. Newsletter
window.enviarSuscripcionNewsletter = function() {
    const inputEmail = document.getElementById('input-email-news');
    const mensajeRespuesta = document.getElementById('mensaje-respuesta-news');
    if (!inputEmail) return;
    const email = inputEmail.value.trim();

    if (!email || !email.includes('@')) {
        if (mensajeRespuesta) {
            mensajeRespuesta.style.display = 'block';
            mensajeRespuesta.style.color = '#f87171';
            mensajeRespuesta.innerText = "Por favor, introduce un correo electrónico válido.";
        }
        return;
    }

    fetch('/api/suscribir-newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email })
    })
    .then(response => response.json())
    .then(data => {
        if (mensajeRespuesta) {
            mensajeRespuesta.style.display = 'block';
            mensajeRespuesta.style.color = data.success ? '#34d399' : '#f87171';
            mensajeRespuesta.innerText = data.message;
        }
        if (data.success) inputEmail.value = '';
    })
    .catch(error => {
        console.error('Error:', error);
        if (mensajeRespuesta) {
            mensajeRespuesta.style.display = 'block';
            mensajeRespuesta.style.color = '#f87171';
            mensajeRespuesta.innerText = "Ocurrió un error al procesar tu solicitud.";
        }
    });
};

// ==========================================
// MÓDULO DE PERFIL - DEFINITIVO Y BLINDADO
// ==========================================

// Guardar cambios del perfil
// Sustituye tu función guardarCambiosPerfil actual por esta versión blindada:

window.completarRegistro = window.guardarCambiosPerfil = async function() {
    const userAuth = auth.currentUser;
    if (!userAuth) {
        mostrarMensajeGuardado('Inicia sesión de nuevo para guardar los cambios en Firebase.', '#ef4444');
        return;
    }

    const valor = (...ids) => {
        for (const id of ids) {
            const input = document.getElementById(id);
            if (input) return input.value.trim();
        }
        return '';
    };
    const fechaNacimiento = valor('input-perfil-fnacimiento', 'fechaNacimiento');
    const perfil = {
        nombre: valor('input-perfil-nombre', 'nombre-input', 'nombre'),
        apellido: valor('input-perfil-apellido', 'apellido-input', 'apellido'),
        username: valor('input-perfil-username', 'username-input'),
        nacionalidad: valor('input-perfil-nacionalidad', 'nacionalidad'),
        nacimiento: fechaNacimiento,
        fechaNacimiento,
        email: userAuth.email || ''
    };

    try {
        await setDoc(doc(db, 'usuarios', userAuth.uid), perfil, { merge: true });
        const cacheRaw = localStorage.getItem('usuario_actual') || localStorage.getItem('user') || '{}';
        const usuario = { ...JSON.parse(cacheRaw), ...perfil, uid: userAuth.uid };
        localStorage.setItem('usuario_actual', JSON.stringify(usuario));
        localStorage.setItem('user', JSON.stringify(usuario));
        window.aplicarDatosEnPantalla(usuario);
        mostrarMensajeGuardado('¡Cambios guardados correctamente en Firebase!', '#22c55e');
    } catch (error) {
        console.error('Error al guardar el perfil en Firestore:', error);
        mostrarMensajeGuardado('No se pudo guardar en Firebase. Revisa la conexión y vuelve a intentarlo.', '#ef4444');
    }
};
// Cargar datos en el perfil sincronizados de forma segura
window.cargarDatosPerfil = async function(userObjetivo) {
    const user = userObjetivo || auth?.currentUser;
    
    // 1. Carga inmediata desde localStorage para que vuele el "Cargando..." al instante
    let dataLocal = JSON.parse(localStorage.getItem('usuario_actual') || localStorage.getItem('user')) || {};
    if (user && !dataLocal.email) dataLocal.email = user.email;
    
    if (typeof aplicarDatosEnPantalla === 'function' && Object.keys(dataLocal).length > 0) {
        aplicarDatosEnPantalla(dataLocal);
    }

    if (!user) return;

    // 2. Intentar buscar en Firestore de forma segura sin romper nada si falla
    try {
        if (typeof db !== 'undefined' && typeof doc === 'function' && typeof getDoc === 'function') {
            const docRef = doc(db, "usuarios", user.uid);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const dataCloud = docSnap.data();
                dataCloud.email = dataCloud.email || user.email;
                
                localStorage.setItem('usuario_actual', JSON.stringify(dataCloud));
                localStorage.setItem('user', JSON.stringify(dataCloud));

                if (typeof aplicarDatosEnPantalla === 'function') {
                    aplicarDatosEnPantalla(dataCloud);
                }
            }
        }
    } catch (error) {
        console.warn("⚠️ Aviso menor de Firestore (usando respaldo local):", error.message);
    }
};

// Función auxiliar para pintar los datos en la pantalla del perfil
window.aplicarDatosEnPantalla = function(data) {
    if (!data) return;
    const emailReal = data.email || auth.currentUser?.email || '';
    const emailPrefix = emailReal ? emailReal.split('@')[0] : '';
    const nombre = data.nombre || emailPrefix || 'Usuario';
    const apellido = data.apellido || '';
    const username = data.username || emailPrefix || nombre;
    const nacimiento = data.fechaNacimiento || data.nacimiento || data.fnacimiento || '';
    const coins = data.birriacoins ?? data.monedas ?? data.coins ?? 100;

    const poner = (ids, valor) => ids.forEach(id => {
        const elemento = document.getElementById(id);
        if (elemento) elemento.innerText = valor;
    });
    const ponerInput = (ids, valor) => ids.forEach(id => {
        const input = document.getElementById(id);
        if (input) input.value = valor;
    });

    poner(['nombre-usuario-display', 'user-display-name'], username);
    poner(['user-name-left-full'], `${nombre} ${apellido}`.trim());
    poner(['username-preview-left'], `@${username}`);
    poner(['user-email-left-full', 'perfil-email'], emailReal);
    poner(['coins-amount', 'coins-amount-profile', 'user-birriacoins'], coins);
    ponerInput(['input-perfil-nombre', 'nombre-input'], nombre);
    ponerInput(['input-perfil-apellido', 'apellido-input'], apellido);
    ponerInput(['input-perfil-username', 'username-input'], username);
    ponerInput(['input-perfil-nacionalidad', 'nacionalidad'], data.nacionalidad || 'España');
    ponerInput(['input-perfil-fnacimiento', 'fechaNacimiento'], nacimiento);

    const avatar = data.avatar || data.photoURL || '';
    const avatarImg = document.getElementById('img-avatar-perfil') || document.getElementById('user-avatar');
    if (avatar && avatarImg) avatarImg.src = avatar;
};
document.addEventListener("DOMContentLoaded", () => {
    // 1. Leer de inmediato del localStorage para pintar la sesión al instante sin esperar a Firebase
    const usuarioGuardado = localStorage.getItem('usuario_actual') || localStorage.getItem('user');
    if (usuarioGuardado && typeof window.cargarDatosPerfil === 'function') {
        try {
            const parsedUser = JSON.parse(usuarioGuardado);
            window.cargarDatosPerfil(parsedUser);
        } catch(e) {
            console.error("Error al leer el usuario local:", e);
        }
    }

;

// 6. Cambiar Contraseña
window.cambiarContrasenaUsuario = async function() {
    const passwordInputs = document.querySelectorAll('input[type="password"]');
    const nuevaPassEl = passwordInputs.length >= 2 ? passwordInputs[passwordInputs.length - 2] : null;
    const confirmarPassEl = passwordInputs.length >= 1 ? passwordInputs[passwordInputs.length - 1] : null;

    const nuevaPass = nuevaPassEl ? nuevaPassEl.value : "";
    const confirmarPass = confirmarPassEl ? confirmarPassEl.value : "";

    if (!nuevaPass || !confirmarPass) {
        Swal.fire({ title: 'Campos vacíos', text: 'Por favor, introduce y confirma la nueva contraseña.', icon: 'warning', confirmButtonText: 'OK', background: '#1b0a38', color: '#ffffff', confirmButtonColor: '#7c3aed' });
        return;
    }

    if (nuevaPass.length < 8) {
        Swal.fire({ title: 'Contraseña muy corta', text: 'La contraseña debe tener al menos 8 caracteres.', icon: 'warning', confirmButtonText: 'OK', background: '#1b0a38', color: '#ffffff', confirmButtonColor: '#7c3aed' });
        return;
    }

    if (nuevaPass !== confirmarPass) {
        Swal.fire({ title: 'No coinciden', text: 'Las nuevas contraseñas no coinciden.', icon: 'error', confirmButtonText: 'OK', background: '#1b0a38', color: '#ffffff', confirmButtonColor: '#ef4444' });
        return;
    }

    const user = auth?.currentUser;
    if (!user) {
        Swal.fire({ title: 'Sesión expirada', text: 'Debes iniciar sesión de nuevo.', icon: 'error', confirmButtonText: 'OK', background: '#1b0a38', color: '#ffffff', confirmButtonColor: '#ef4444' });
        return;
    }

    try {
        await updatePassword(user, nuevaPass);
        if (nuevaPassEl) nuevaPassEl.value = "";
        if (confirmarPassEl) confirmarPassEl.value = "";
        Swal.fire({ title: '¡Contraseña actualizada!', text: 'Se ha cambiado tu contraseña con éxito.', icon: 'success', confirmButtonText: 'OK', background: '#1b0a38', color: '#ffffff', confirmButtonColor: '#7c3aed' });
    } catch (error) {
        Swal.fire({ title: 'Error', text: "No se pudo actualizar: " + error.message, icon: 'error', confirmButtonText: 'OK', background: '#1b0a38', color: '#ffffff', confirmButtonColor: '#ef4444' });
    }
};

// Carga inicial al cargar el DOM
document.addEventListener("DOMContentLoaded", () => {
    let datosLocales = JSON.parse(localStorage.getItem('usuario_actual') || localStorage.getItem('user'));
    if (datosLocales && typeof aplicarDatosEnPantalla === 'function') {
        aplicarDatosEnPantalla(datosLocales);
    }
});

// Sincronización con Firebase Auth blindada
if (typeof auth !== 'undefined' && typeof onAuthStateChanged === 'function') {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            if (typeof window.cargarDatosPerfil === 'function') {
                window.cargarDatosPerfil(user);
            }
        } else {
            // Protección: Si Firebase dice que no hay usuario, 
            // comprobamos si al menos tenemos datos previos en el localStorage para no borrarlos
            const usuarioGuardado = localStorage.getItem('usuario_actual') || localStorage.getItem('user');
            if (usuarioGuardado) {
                console.log("Sesión mantenida mediante respaldo local.");
            } else {
                console.log("No hay sesión activa.");
            }
        }
    });
}
});
