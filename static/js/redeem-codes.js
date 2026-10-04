(() => {
    const iconosParticula = ['✦', '✧', '✨'];
    const coloresParticula = ['#6ff6ff', '#ffd54a', '#ffffff', '#a78bfa'];

    function mostrarMensaje(texto, tipo = '') {
        const feedback = document.getElementById('redeem-feedback');
        if (!feedback) return;
        feedback.textContent = texto;
        feedback.classList.remove('is-error', 'is-success');
        if (tipo) feedback.classList.add(`is-${tipo}`);
    }

    function lanzarParticulas(panel) {
        if (!panel) return;
        panel.classList.remove('is-rewarded');
        void panel.offsetWidth;
        panel.classList.add('is-rewarded');

        const coinImage = panel.querySelector('.redeem-orbit img')?.src || '/static/images/birriacoin.png';
        for (let i = 0; i < 24; i += 1) {
            const particle = document.createElement('span');
            particle.className = 'redeem-particle';
            if (i % 4 === 2) {
                const image = document.createElement('img');
                image.src = coinImage;
                image.alt = '';
                particle.classList.add('is-coin');
                particle.appendChild(image);
            } else {
                particle.textContent = iconosParticula[i % iconosParticula.length];
            }
            particle.style.setProperty('--particle-x', `${8 + Math.random() * 84}%`);
            particle.style.setProperty('--particle-dx', `${Math.round(Math.random() * 180 - 90)}px`);
            particle.style.setProperty('--particle-color', coloresParticula[i % coloresParticula.length]);
            particle.style.setProperty('--particle-size', `${12 + Math.random() * 12}px`);
            particle.style.setProperty('--particle-duration', `${1.05 + Math.random() * .8}s`);
            panel.appendChild(particle);
            particle.addEventListener('animationend', () => particle.remove(), { once: true });
        }
    }

    function animarSaldo(saldoNuevo, usuario) {
        const elementos = ['coins-amount', 'user-birriacoins', 'coins-amount-profile']
            .map(id => document.getElementById(id))
            .filter(Boolean);
        const saldoPrevio = Number(window.birriacoins ?? saldoNuevo) || 0;
        const inicio = performance.now();
        const duracion = 950;

        window.birriacoins = saldoNuevo;
        localStorage.setItem('birriacoins', String(saldoNuevo));
        elementos.forEach(elemento => {
            elemento.classList.remove('redeem-balance-pop');
            void elemento.offsetWidth;
            elemento.classList.add('redeem-balance-pop');
        });
        for (const key of ['usuario_actual', 'user']) {
            try {
                const datos = JSON.parse(localStorage.getItem(key) || 'null');
                if (datos && (!datos.uid || datos.uid === usuario.uid)) {
                    datos.birriacoins = saldoNuevo;
                    localStorage.setItem(key, JSON.stringify(datos));
                }
            } catch (error) {
                console.warn('No se pudo sincronizar el saldo local:', error);
            }
        }

        function frame(ahora) {
            const progreso = Math.min((ahora - inicio) / duracion, 1);
            const suavizado = 1 - (1 - progreso) ** 3;
            const visible = Math.round(saldoPrevio + (saldoNuevo - saldoPrevio) * suavizado).toLocaleString('es-ES');
            elementos.forEach(elemento => {
                elemento.textContent = visible;
            });
            if (progreso < 1) requestAnimationFrame(frame);
            else setTimeout(() => elementos.forEach(elemento => elemento.classList.remove('redeem-balance-pop')), 450);
        }
        requestAnimationFrame(frame);
    }

    window.redeemCode = async function() {
        const input = document.getElementById('code-input');
        const button = document.getElementById('btn-redeem-code');
        const panel = document.getElementById('redeem-panel');
        const usuario = window.auth?.currentUser;
        const codigo = (input?.value || '').trim().toUpperCase().replace(/[\s-]/g, '');

        if (!usuario) {
            mostrarMensaje('Inicia sesión para canjear BirriaCoins.', 'error');
            if (typeof Swal !== 'undefined') {
                const resultado = await Swal.fire({
                    title: 'Inicia sesión primero',
                    text: 'Inicia sesión para guardar tu recompensa.',
                    icon: 'info',
                    showCancelButton: true,
                    confirmButtonText: 'Iniciar sesión',
                    cancelButtonText: 'Ahora no',
                    background: '#150a29', color: '#fff', confirmButtonColor: '#087cff'
                });
                if (resultado.isConfirmed && typeof window.abrirModalAcceso === 'function') window.abrirModalAcceso();
            }
            return;
        }

        if (!codigo) {
            mostrarMensaje('Escribe uno de tus códigos para continuar.', 'error');
            input?.focus();
            return;
        }

        if (button) {
            button.disabled = true;
            button.classList.add('is-loading');
            button.innerHTML = '<span class="redeem-button-icon" aria-hidden="true">⏳</span> VALIDANDO CÓDIGO…';
        }
        mostrarMensaje('Comprobando el código y guardando tu saldo…');

        try {
            const token = await usuario.getIdToken();
            const response = await fetch('/api/redeem-code', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ code: codigo })
            });
            const result = await response.json();
            if (!response.ok || !result.success) {
                throw new Error(result.message || 'No se pudo canjear este código.');
            }

            input.value = '';
            animarSaldo(Number(result.balance), usuario);
            lanzarParticulas(panel);
            mostrarMensaje(`¡Canje completado! +${Number(result.reward).toLocaleString('es-ES')} BirriaCoins guardadas.`, 'success');
            if (typeof Swal !== 'undefined') {
                await Swal.fire({
                    title: '¡Recompensa desbloqueada!',
                    html: `<strong style="font-size:1.45em;color:#fde047">+${Number(result.reward).toLocaleString('es-ES')} BirriaCoins</strong><br><span style="color:#cbd5e1">El nuevo saldo se guardó en tu cuenta.</span>`,
                    icon: 'success', background: '#150a29', color: '#fff', confirmButtonColor: '#087cff'
                });
            }
        } catch (error) {
            mostrarMensaje(error.message || 'No se pudo completar el canje.', 'error');
            if (typeof Swal !== 'undefined') {
                await Swal.fire({
                    title: 'No se pudo canjear',
                    text: error.message || 'Comprueba el código e inténtalo de nuevo.',
                    icon: 'error', background: '#150a29', color: '#fff', confirmButtonColor: '#ef4444'
                });
            }
        } finally {
            if (button) {
                button.disabled = false;
                button.classList.remove('is-loading');
                button.innerHTML = '<span class="redeem-button-icon" aria-hidden="true">🎁</span> CANJEAR CÓDIGO';
            }
        }
    };

    document.addEventListener('DOMContentLoaded', () => {
        const input = document.getElementById('code-input');
        input?.addEventListener('keydown', event => {
            if (event.key === 'Enter') window.redeemCode();
        });
        input?.addEventListener('input', () => {
            const cursor = input.selectionStart;
            const codigoMayuscula = input.value.toUpperCase();
            if (input.value !== codigoMayuscula) {
                input.value = codigoMayuscula;
                const posicion = Math.min(cursor ?? input.value.length, input.value.length);
                input.setSelectionRange(posicion, posicion);
            }
            mostrarMensaje('');
        });
    }, { once: true });
})();
