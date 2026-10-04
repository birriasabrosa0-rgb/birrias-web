(() => {
    const meses = Array.from({ length: 12 }, (_, mes) =>
        new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(new Date(2024, mes, 1))
    );
    const semana = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const maxAnio = hoy.getFullYear();
    const minAnio = 1900;

    function isoADate(valor) {
        if (!valor) return null;
        const [anio, mes, dia] = valor.split('-').map(Number);
        if (!anio || !mes || !dia) return null;
        return new Date(anio, mes - 1, dia);
    }

    function formatoVisible(fecha) {
        if (!fecha) return '';
        return `${String(fecha.getDate()).padStart(2, '0')}/${String(fecha.getMonth() + 1).padStart(2, '0')}/${fecha.getFullYear()}`;
    }

    function inicializarSelector(input) {
        if (input.dataset.birthdatePickerReady === 'true') return;
        input.dataset.birthdatePickerReady = 'true';
        input.classList.add('birthdate-picker-source');
        input.setAttribute('aria-hidden', 'true');
        input.tabIndex = -1;

        const envoltorio = document.createElement('div');
        envoltorio.className = 'birthdate-picker';
        input.insertAdjacentElement('afterend', envoltorio);

        const boton = document.createElement('button');
        boton.type = 'button';
        boton.className = 'birthdate-picker-trigger';
        boton.setAttribute('aria-haspopup', 'dialog');
        boton.setAttribute('aria-expanded', 'false');
        boton.setAttribute('aria-label', 'Elegir fecha de nacimiento');
        boton.innerHTML = '<span class="birthdate-picker-placeholder">Selecciona día, mes y año</span><span class="birthdate-picker-icon" aria-hidden="true">📅</span>';

        const panel = document.createElement('div');
        panel.className = 'birthdate-calendar';
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-label', 'Calendario de fecha de nacimiento');
        panel.hidden = true;
        panel.innerHTML = `
            <div class="birthdate-calendar-toolbar">
                <button type="button" class="birthdate-calendar-nav" data-move="-1" aria-label="Mes anterior">‹</button>
                <select class="birthdate-calendar-select" aria-label="Mes"></select>
                <select class="birthdate-calendar-select" aria-label="Año"></select>
                <button type="button" class="birthdate-calendar-nav" data-move="1" aria-label="Mes siguiente">›</button>
            </div>
            <div class="birthdate-weekdays" aria-hidden="true"></div>
            <div class="birthdate-days" role="grid"></div>
            <p class="birthdate-calendar-hint">Elige tu día de nacimiento</p>`;

        envoltorio.append(boton, panel);
        const monthSelect = panel.querySelector('[aria-label="Mes"]');
        const yearSelect = panel.querySelector('[aria-label="Año"]');
        const daysGrid = panel.querySelector('.birthdate-days');
        const weekGrid = panel.querySelector('.birthdate-weekdays');
        weekGrid.innerHTML = semana.map(dia => `<span class="birthdate-weekday">${dia}</span>`).join('');
        monthSelect.innerHTML = meses.map((mes, index) => `<option value="${index}">${mes[0].toLocaleUpperCase('es-ES')}${mes.slice(1)}</option>`).join('');
        yearSelect.innerHTML = Array.from({ length: maxAnio - minAnio + 1 }, (_, index) => maxAnio - index)
            .map(anio => `<option value="${anio}">${anio}</option>`).join('');

        const dateInicial = isoADate(input.value) || new Date(maxAnio - 18, hoy.getMonth(), 1);
        let vistaAnio = dateInicial.getFullYear();
        let vistaMes = dateInicial.getMonth();

        const cerrar = () => {
            panel.hidden = true;
            boton.setAttribute('aria-expanded', 'false');
        };

        const actualizarBoton = () => {
            const fecha = isoADate(input.value);
            boton.innerHTML = fecha
                ? `<span>${formatoVisible(fecha)}</span><span class="birthdate-picker-icon" aria-hidden="true">📅</span>`
                : '<span class="birthdate-picker-placeholder">Selecciona día, mes y año</span><span class="birthdate-picker-icon" aria-hidden="true">📅</span>';
        };

        const dibujarMes = () => {
            monthSelect.value = String(vistaMes);
            yearSelect.value = String(vistaAnio);
            const primerDia = (new Date(vistaAnio, vistaMes, 1).getDay() + 6) % 7;
            const diasMes = new Date(vistaAnio, vistaMes + 1, 0).getDate();
            const seleccionada = input.value;
            daysGrid.replaceChildren();

            for (let vacio = 0; vacio < primerDia; vacio++) {
                const celda = document.createElement('span');
                celda.className = 'birthdate-day-blank';
                celda.setAttribute('aria-hidden', 'true');
                daysGrid.appendChild(celda);
            }

            for (let dia = 1; dia <= diasMes; dia++) {
                const fecha = new Date(vistaAnio, vistaMes, dia);
                const iso = `${vistaAnio}-${String(vistaMes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
                const celda = document.createElement('button');
                celda.type = 'button';
                celda.className = 'birthdate-day';
                celda.textContent = String(dia);
                celda.setAttribute('role', 'gridcell');
                celda.setAttribute('aria-label', fecha.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }));
                if (iso === seleccionada) celda.classList.add('is-selected');
                if (fecha.getTime() === hoy.getTime()) celda.classList.add('is-today');
                if (fecha > hoy) celda.disabled = true;
                celda.addEventListener('click', () => {
                    input.value = iso;
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                    actualizarBoton();
                    cerrar();
                    boton.focus();
                });
                daysGrid.appendChild(celda);
            }
        };

        monthSelect.addEventListener('change', () => {
            vistaMes = Number(monthSelect.value);
            dibujarMes();
        });
        yearSelect.addEventListener('change', () => {
            vistaAnio = Number(yearSelect.value);
            dibujarMes();
        });
        panel.querySelectorAll('[data-move]').forEach(nav => {
            nav.addEventListener('click', () => {
                const fecha = new Date(vistaAnio, vistaMes + Number(nav.dataset.move), 1);
                if (fecha.getFullYear() < minAnio || fecha > new Date(maxAnio, hoy.getMonth(), 1)) return;
                vistaAnio = fecha.getFullYear();
                vistaMes = fecha.getMonth();
                dibujarMes();
            });
        });
        boton.addEventListener('click', () => {
            const abrir = panel.hidden;
            document.querySelectorAll('.birthdate-calendar:not([hidden])').forEach(otroPanel => {
                otroPanel.hidden = true;
                otroPanel.parentElement?.querySelector('.birthdate-picker-trigger')?.setAttribute('aria-expanded', 'false');
            });
            panel.hidden = !abrir;
            boton.setAttribute('aria-expanded', String(abrir));
            if (abrir) dibujarMes();
        });
        document.addEventListener('click', event => {
            if (!envoltorio.contains(event.target)) cerrar();
        });
        input.addEventListener('change', actualizarBoton);
        actualizarBoton();
        dibujarMes();
    }

    function iniciar() {
        document.querySelectorAll('input[type="date"][id*="nacimiento"]').forEach(inicializarSelector);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar, { once: true });
    else iniciar();
})();
