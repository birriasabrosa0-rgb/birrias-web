import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import { doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

const form = document.getElementById('brawl-account-form');
if (form) {
    const inputTag = document.getElementById('brawl-account-tag');
    const submitButton = document.getElementById('brawl-account-submit');
    const status = document.getElementById('brawl-account-message');
    const dashboard = document.getElementById('brawl-player-dashboard');
    const rosterRail = document.getElementById('brawl-brawler-rail');
    const rosterTrack = document.getElementById('brawl-brawler-track');
    const rosterMessage = document.getElementById('brawl-collection-message');
    const searchInput = document.getElementById('brawl-brawler-search');
    const sortSelect = document.getElementById('brawl-brawler-sort');
    const collectionCount = document.getElementById('brawl-collection-count');

    const state = {
        user: null,
        player: null,
        brawlers: [],
        view: 'all',
        query: ''
    };

    const number = value => Number(value || 0).toLocaleString('es-ES');
    const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);

    function localizedName(value) {
        if (typeof value === 'string') return value;
        if (value && typeof value === 'object') return value.es || value.en || value.name || Object.values(value)[0] || 'Brawler';
        return 'Brawler';
    }

    function showStatus(message, kind = 'neutral') {
        status.textContent = message;
        status.dataset.kind = kind;
    }

    function imageForBrawler(id) {
        const numericId = Number(id);
        return Number.isFinite(numericId) && numericId > 0
            ? `https://cdn.brawlify.com/brawlers/borderless/${numericId}.png`
            : '/static/images/shelly.png';
    }

    function renderStats(player) {
        const brawlers = Array.isArray(player.brawlers) ? player.brawlers : [];
        const prestigeTotal = player.totalPrestigeLevel != null
            ? Number(player.totalPrestigeLevel)
            : brawlers.some(brawler => brawler.prestigeLevel != null)
                ? brawlers.reduce((sum, brawler) => sum + Number(brawler.prestigeLevel || 0), 0)
                : null;
        const metrics = [
            { icon: '🏆', label: 'COPAS', value: number(player.trophies), tone: 'gold' },
            { icon: '✨', label: 'RÉCORD', value: number(player.highestTrophies), tone: 'blue' },
            { icon: '👊', label: 'BRAWLERS', value: `${brawlers.length} / ${state.brawlers.length || '—'}`, tone: 'pink' },
            { icon: '⚡', label: 'PRESTIGIO TOTAL', value: prestigeTotal == null ? '—' : number(prestigeTotal), tone: 'purple' }
        ];
        document.getElementById('brawl-player-stats').innerHTML = metrics.map(metric => `
            <article class="brawl-stat-tile brawl-stat-${metric.tone}">
                <span class="brawl-stat-icon" aria-hidden="true">${metric.icon}</span>
                <span class="brawl-stat-label">${metric.label}</span>
                <strong>${metric.value}</strong>
            </article>
        `).join('');

        const wins3v3 = player['3vs3Victories'];
        const meta = [];
        if (wins3v3 != null) meta.push(`<span>⚔️ <strong>${number(wins3v3)}</strong> victorias 3 vs 3</span>`);
        if (player.soloVictories != null) meta.push(`<span>🎯 <strong>${number(player.soloVictories)}</strong> victorias en Solo</span>`);
        if (player.duoVictories != null) meta.push(`<span>🤝 <strong>${number(player.duoVictories)}</strong> victorias en Dúo</span>`);
        meta.push(`<span>🏅 Récord de copas: <strong>${number(player.highestTrophies)}</strong></span>`);
        document.getElementById('brawl-player-meta').innerHTML = meta.join('');
    }

    function renderPlayer(player) {
        state.player = player;
        const iconId = Number(player.icon?.id);
        const avatar = document.getElementById('brawl-player-avatar');
        avatar.src = Number.isFinite(iconId) && iconId > 0
            ? `https://cdn.brawlify.com/profile-icons/regular/${iconId}.png`
            : '/static/images/birriasprofile.jpg';
        avatar.alt = `Icono de ${player.name || 'jugador'}`;
        document.getElementById('brawl-player-name').textContent = player.name || 'Jugador';
        document.getElementById('brawl-player-tag').textContent = player.tag || '';
        document.getElementById('brawl-player-club').textContent = player.club?.name || 'SIN CLUB';
        renderStats(player);
        dashboard.hidden = false;
        document.getElementById('brawl-tab-owned').disabled = false;
        document.getElementById('brawl-collection-description').textContent = 'Tu fuerza, copas y prestigios, organizados por Brawler.';
        renderRoster();
    }

    function renderRoster() {
        const playerBrawlers = Array.isArray(state.player?.brawlers) ? state.player.brawlers : [];
        const ownedById = new Map(playerBrawlers.map(brawler => [String(brawler.id), brawler]));
        let brawlers = state.view === 'owned'
            ? playerBrawlers.map(brawler => ({ ...brawler, owned: true }))
            : state.brawlers.map(brawler => ({ ...brawler, ...(ownedById.get(String(brawler.id)) || {}), owned: ownedById.has(String(brawler.id)) }));

        const query = state.query.trim().toLocaleLowerCase('es');
        if (query) brawlers = brawlers.filter(brawler => localizedName(brawler.name).toLocaleLowerCase('es').includes(query));

        const sortBy = sortSelect.value;
        brawlers.sort((a, b) => {
            if (sortBy === 'trophies') return Number(b.trophies || 0) - Number(a.trophies || 0) || localizedName(a.name).localeCompare(localizedName(b.name), 'es');
            if (sortBy === 'power') return Number(b.power || 0) - Number(a.power || 0) || localizedName(a.name).localeCompare(localizedName(b.name), 'es');
            if (sortBy === 'prestige') return Number(b.prestigeLevel || 0) - Number(a.prestigeLevel || 0) || localizedName(a.name).localeCompare(localizedName(b.name), 'es');
            return localizedName(a.name).localeCompare(localizedName(b.name), 'es');
        });

        const total = state.view === 'owned' ? playerBrawlers.length : state.brawlers.length;
        collectionCount.textContent = state.view === 'owned'
            ? `${number(brawlers.length)} / ${number(total)} DESBLOQUEADOS`
            : `${number(total)} BRAWLERS`;

        if (state.view === 'owned' && !state.player) {
            rosterMessage.textContent = 'Vincula tu Brawl ID para ver los personajes de tu cuenta.';
            rosterMessage.hidden = false;
            rosterTrack.innerHTML = '';
            return;
        }
        if (!brawlers.length) {
            rosterMessage.textContent = state.query ? 'No hay Brawlers con ese nombre.' : 'No hay datos para mostrar.';
            rosterMessage.hidden = false;
            rosterTrack.innerHTML = '';
            return;
        }

        rosterMessage.hidden = true;
        rosterTrack.innerHTML = brawlers.map(brawler => {
            const name = localizedName(brawler.name);
            const trophies = Number(brawler.trophies || 0);
            const power = brawler.power == null ? null : Number(brawler.power);
            const prestige = brawler.prestigeLevel == null ? null : Number(brawler.prestigeLevel);
            const rank = brawler.rank == null ? null : Number(brawler.rank);
            const progress = Math.max(0, Math.min(100, (trophies / 1000) * 100));
            const prestigeLabel = prestige == null ? 'PRESTIGIO —' : `PRESTIGIO ${prestige}`;
            const cardClass = brawler.owned ? 'brawl-brawler-card owned' : 'brawl-brawler-card locked';
            const trophyValue = brawler.owned ? number(trophies) : '—';
            const powerValue = power == null ? '—' : power;
            const powerDots = power == null ? '' : `<div class="brawl-power-pips" aria-label="Fuerza ${power} de 11">${Array.from({ length: 11 }, (_, index) => `<i class="${index < power ? 'filled' : ''}"></i>`).join('')}</div>`;

            return `
                <article class="${cardClass}" title="${escapeHTML(name)}">
                    <div class="brawl-brawler-card-top"><span>${brawler.owned ? 'EN TU CUENTA' : 'POR DESBLOQUEAR'}</span><span class="brawl-prestige-chip">${escapeHTML(prestigeLabel)}</span></div>
                    <div class="brawl-brawler-art"><img loading="lazy" src="${imageForBrawler(brawler.id)}" alt="${escapeHTML(name)}" onerror="this.onerror=null;this.src='/static/images/shelly.png'"><span class="brawl-brawler-card-shine"></span></div>
                    <h4>${escapeHTML(name)}</h4>
                    <div class="brawl-brawler-trophy-row"><span>🏆 ${trophyValue}</span><span>${rank == null ? 'RANGO —' : `RANGO ${rank}`}</span></div>
                    <div class="brawl-trophy-progress"><i style="width:${brawler.owned ? progress : 0}%"></i></div>
                    <div class="brawl-brawler-power-row"><span>FUERZA <strong>${powerValue}</strong></span>${powerDots}</div>
                </article>
            `;
        }).join('');
        rosterRail.scrollTo({ left: 0, behavior: 'smooth' });
    }

    async function loadCatalog() {
        rosterMessage.textContent = 'Cargando el catálogo de Brawlers…';
        rosterMessage.hidden = false;
        try {
            const response = await fetch('/api/brawlers');
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error || 'No se pudo cargar el catálogo.');
            state.brawlers = Array.isArray(payload.items) ? payload.items : [];
            document.getElementById('brawl-collection-count').textContent = `${number(state.brawlers.length)} BRAWLERS`;
            if (state.player) renderStats(state.player);
            renderRoster();
        } catch (error) {
            rosterMessage.textContent = error.message || 'No se pudo cargar el catálogo de Brawlers.';
            rosterMessage.hidden = false;
            collectionCount.textContent = 'CATÁLOGO NO DISPONIBLE';
        }
    }

    async function loadPlayer(tag, saveTag) {
        if (!tag) {
            showStatus('Escribe la etiqueta que aparece en el perfil de Brawl Stars.', 'error');
            return;
        }
        submitButton.disabled = true;
        submitButton.classList.add('loading');
        submitButton.innerHTML = '<span class="brawl-spinner" aria-hidden="true"></span> BUSCANDO…';
        showStatus('Conectando con tu perfil de Brawl Stars…', 'loading');
        try {
            const response = await fetch(`/api/player/${encodeURIComponent(tag)}`, { cache: 'no-store' });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error || 'No se pudo consultar este perfil.');

            if (saveTag) {
                if (!state.user) throw new Error('Inicia sesión para guardar tu etiqueta en la cuenta.');
                await setDoc(doc(db, 'usuarios', state.user.uid), { brawlTag: payload.tag || tag }, { merge: true });
                let localUser = {};
                try {
                    localUser = JSON.parse(localStorage.getItem('usuario_actual') || localStorage.getItem('user') || '{}');
                } catch (_) {
                    localUser = {};
                }
                localUser.brawlTag = payload.tag || tag;
                localStorage.setItem('usuario_actual', JSON.stringify(localUser));
                localStorage.setItem('user', JSON.stringify(localUser));
                inputTag.value = payload.tag || tag;
                showStatus('¡Brawl ID guardado! Tus datos se actualizaron desde el juego.', 'success');
            } else {
                showStatus('Perfil actualizado con los datos disponibles del juego.', 'success');
            }
            renderPlayer(payload);
            document.getElementById('brawl-tab-owned').click();
        } catch (error) {
            showStatus(error.message || 'No se pudo cargar el perfil. Inténtalo de nuevo.', 'error');
        } finally {
            submitButton.disabled = false;
            submitButton.classList.remove('loading');
            submitButton.innerHTML = '<span aria-hidden="true">⚡</span> GUARDAR Y BUSCAR';
        }
    }

    form.addEventListener('submit', event => {
        event.preventDefault();
        const rawTag = inputTag.value.trim().toUpperCase().replace(/\s+/g, '');
        const normalizedTag = rawTag.startsWith('#') ? rawTag : `#${rawTag}`;
        if (!/^#[A-Z0-9]{3,15}$/.test(normalizedTag)) {
            showStatus('La etiqueta no tiene un formato válido. Ejemplo: #2PP12345.', 'error');
            inputTag.focus();
            return;
        }
        loadPlayer(normalizedTag, true);
    });

    document.querySelectorAll('[data-brawl-view]').forEach(button => {
        button.addEventListener('click', () => {
            if (button.dataset.brawlView === 'owned' && !state.player) {
                showStatus('Primero guarda tu etiqueta para consultar tu colección.', 'neutral');
                return;
            }
            state.view = button.dataset.brawlView;
            document.querySelectorAll('[data-brawl-view]').forEach(tab => {
                const selected = tab === button;
                tab.classList.toggle('active', selected);
                tab.setAttribute('aria-selected', String(selected));
            });
            document.getElementById('brawl-collection-title').textContent = state.view === 'owned' ? 'Mis Brawlers' : 'Todos los Brawlers';
            renderRoster();
        });
    });

    searchInput.addEventListener('input', () => {
        state.query = searchInput.value;
        renderRoster();
    });
    sortSelect.addEventListener('change', renderRoster);
    document.getElementById('brawl-carousel-left').addEventListener('click', () => rosterRail.scrollBy({ left: -320, behavior: 'smooth' }));
    document.getElementById('brawl-carousel-right').addEventListener('click', () => rosterRail.scrollBy({ left: 320, behavior: 'smooth' }));

    loadCatalog();
    onAuthStateChanged(auth, async user => {
        state.user = user || null;
        if (!user) {
            showStatus('Inicia sesión para guardar tu Brawl ID y volver a consultarlo cuando quieras.', 'neutral');
            return;
        }
        try {
            const snapshot = await getDoc(doc(db, 'usuarios', user.uid));
            const savedTag = snapshot.exists() ? snapshot.data().brawlTag : '';
            if (savedTag) {
                inputTag.value = savedTag;
                await loadPlayer(savedTag, false);
            } else {
                showStatus('Escribe tu etiqueta para cargar tus copas y Brawlers.', 'neutral');
            }
        } catch (error) {
            console.warn('No se pudo leer el Brawl ID guardado:', error);
            showStatus('Escribe tu etiqueta de jugador para consultar tu cuenta.', 'neutral');
        }
    });
}
