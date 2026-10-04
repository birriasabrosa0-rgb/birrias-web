(() => {
    const requisitos = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/];

    function evaluarPassword(valor) {
        if (!valor) return { texto: 'Escribe una contraseña', color: '#94a3b8' };
        const tipos = requisitos.reduce((total, regex) => total + Number(regex.test(valor)), 0);
        if (valor.length < 8 || tipos < 2) {
            return { texto: 'No es muy segura', color: '#fb7185' };
        }
        if ((valor.length >= 12 && tipos >= 3) || (valor.length >= 8 && tipos === 4)) {
            return { texto: 'Segura', color: '#34d399' };
        }
        return { texto: 'Medianamente segura', color: '#fbbf24' };
    }

    function prepararIndicadores() {
        document.querySelectorAll('input[type="password"]').forEach((campo) => {
            if (campo.dataset.strengthReady === 'true') return;
            campo.dataset.strengthReady = 'true';

            const indicador = document.createElement('small');
            indicador.setAttribute('aria-live', 'polite');
            indicador.style.cssText = 'display:block;min-height:15px;margin:3px 0 7px;text-align:right;font-size:11px;font-weight:700;transition:color .2s ease;';

            const envoltorio = campo.parentElement;
            const esEnvoltorioPassword = envoltorio && getComputedStyle(envoltorio).position === 'relative';
            if (esEnvoltorioPassword) envoltorio.insertAdjacentElement('afterend', indicador);
            else campo.insertAdjacentElement('afterend', indicador);

            const actualizar = () => {
                const estado = evaluarPassword(campo.value);
                indicador.textContent = estado.texto;
                indicador.style.color = estado.color;
            };
            campo.addEventListener('input', actualizar);
            actualizar();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', prepararIndicadores, { once: true });
    } else {
        prepararIndicadores();
    }
})();
