(() => {
    function crearSelectorBandera(select) {
        if (select.dataset.flagPickerReady === 'true') return;
        select.dataset.flagPickerReady = 'true';
        select.classList.add('flag-picker-source');

        const wrapper = document.createElement('div');
        wrapper.className = 'flag-picker';
        select.insertAdjacentElement('afterend', wrapper);

        const trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = 'flag-picker-trigger';
        trigger.setAttribute('role', 'combobox');
        trigger.setAttribute('aria-haspopup', 'listbox');
        trigger.setAttribute('aria-expanded', 'false');
        trigger.setAttribute('aria-label', select.getAttribute('aria-label') || 'Nacionalidad');

        const menu = document.createElement('div');
        menu.className = 'flag-picker-menu';
        menu.setAttribute('role', 'listbox');
        menu.setAttribute('aria-label', select.getAttribute('aria-label') || 'Nacionalidad');
        menu.hidden = true;

        const opciones = Array.from(select.options).map(option => {
            const boton = document.createElement('button');
            boton.type = 'button';
            boton.className = 'flag-picker-option';
            boton.setAttribute('role', 'option');
            boton.dataset.value = option.value;

            const contenido = document.createElement('span');
            contenido.className = 'flag-picker-option-content';
            if (option.dataset.flag) {
                const bandera = document.createElement('img');
                bandera.src = `/static/images/${option.dataset.flag}`;
                bandera.alt = '';
                bandera.width = 28;
                bandera.height = 20;
                contenido.appendChild(bandera);
            }
            const nombre = document.createElement('span');
            nombre.textContent = option.textContent.trim();
            contenido.appendChild(nombre);
            boton.appendChild(contenido);
            menu.appendChild(boton);
            return boton;
        });

        const cerrar = ({ devolverFoco = false } = {}) => {
            menu.hidden = true;
            trigger.setAttribute('aria-expanded', 'false');
            if (devolverFoco) trigger.focus();
        };

        const actualizarVista = () => {
            const option = select.selectedOptions[0] || select.options[0];
            if (!option) return;
            const contenido = document.createElement('span');
            contenido.className = 'flag-picker-current';
            if (option.dataset.flag) {
                const bandera = document.createElement('img');
                bandera.src = `/static/images/${option.dataset.flag}`;
                bandera.alt = '';
                bandera.width = 28;
                bandera.height = 20;
                contenido.appendChild(bandera);
            }
            const nombre = document.createElement('span');
            nombre.textContent = option.textContent.trim();
            const flecha = document.createElement('span');
            flecha.className = 'flag-picker-chevron';
            flecha.setAttribute('aria-hidden', 'true');
            flecha.textContent = '▼';
            contenido.appendChild(nombre);
            trigger.replaceChildren(contenido, flecha);

            opciones.forEach(boton => {
                const selected = boton.dataset.value === select.value;
                boton.setAttribute('aria-selected', String(selected));
            });
        };

        trigger.addEventListener('click', () => {
            const abrir = menu.hidden;
            document.querySelectorAll('.flag-picker-menu:not([hidden])').forEach(otroMenu => {
                otroMenu.hidden = true;
                otroMenu.parentElement?.querySelector('.flag-picker-trigger')?.setAttribute('aria-expanded', 'false');
            });
            menu.hidden = !abrir;
            trigger.setAttribute('aria-expanded', String(abrir));
        });

        opciones.forEach(boton => {
            boton.addEventListener('click', () => {
                select.value = boton.dataset.value;
                select.dispatchEvent(new Event('input', { bubbles: true }));
                select.dispatchEvent(new Event('change', { bubbles: true }));
                cerrar({ devolverFoco: true });
            });
        });

        trigger.addEventListener('keydown', event => {
            if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                menu.hidden = false;
                trigger.setAttribute('aria-expanded', 'true');
                opciones.find(boton => boton.dataset.value === select.value)?.focus();
            }
        });
        menu.addEventListener('keydown', event => {
            const actual = opciones.indexOf(document.activeElement);
            if (event.key === 'Escape') {
                event.preventDefault();
                cerrar({ devolverFoco: true });
            } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                const paso = event.key === 'ArrowDown' ? 1 : -1;
                opciones[(actual + paso + opciones.length) % opciones.length]?.focus();
            }
        });
        document.addEventListener('click', event => {
            if (!wrapper.contains(event.target)) cerrar();
        });
        select.addEventListener('change', actualizarVista);

        wrapper.append(trigger, menu);
        actualizarVista();
    }

    function iniciar() {
        document.querySelectorAll('select[data-flag-picker], select#input-perfil-nacionalidad')
            .forEach(crearSelectorBandera);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', iniciar, { once: true });
    } else {
        iniciar();
    }
})();
