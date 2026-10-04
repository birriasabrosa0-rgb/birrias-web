// Inicializar Firebase (Versión compatible con SDKs globales)
if (!firebase.apps.length) {
    firebase.initializeApp({
        apiKey: "AIzaSyBEmwTzhLohBLGAh72zFv3ei3IeQ14EmVk",
        authDomain: "birrias.firebaseapp.com",
        projectId: "birrias",
        storageBucket: "birrias.firebasestorage.app",
        messagingSenderId: "730620829071",
        appId: "1:730620829071:web:e7aec585f68e49f5f9bffa",
        measurementId: "G-49K10FZ035"
    });
}

// Mantiene la copia pública del ranking sincronizada con el perfil del usuario autenticado.
// Nunca copia email ni fecha de nacimiento al ranking público.
(function enlazarRankingPublicoConPerfil() {
    if (typeof firebase === 'undefined' || !firebase.auth || !firebase.firestore) return;
    let dejarDeEscucharPerfil = null;
    firebase.auth().onAuthStateChanged(user => {
        if (dejarDeEscucharPerfil) {
            dejarDeEscucharPerfil();
            dejarDeEscucharPerfil = null;
        }
        if (!user) return;
        const dbCompat = firebase.firestore();
        const perfilRef = dbCompat.collection('usuarios').doc(user.uid);
        dejarDeEscucharPerfil = perfilRef.onSnapshot(async snapshot => {
            if (!snapshot.exists) return;
            const perfil = snapshot.data() || {};
            const coins = Number(perfil.birriacoins ?? 0);
            const minutos = Number(perfil.minutos ?? perfil.minutosOnline ?? perfil.tiempoUsoMinutos ?? 0);
            const ranking = {
                uid: user.uid,
                username: perfil.username || perfil.nombre || 'Jugador',
                nombre: perfil.nombre || perfil.username || 'Jugador',
                birriacoins: Number.isFinite(coins) ? coins : 0,
                minutos: Number.isFinite(minutos) ? minutos : 0,
                nacionalidad: perfil.nacionalidad || '',
                avatar: perfil.avatar || perfil.fotoPerfil || ''
            };
            try {
                await dbCompat.collection('ranking_publico').doc(user.uid).set(ranking, { merge: true });
            } catch (error) {
                console.warn('No se pudo actualizar la entrada pública del ranking:', error);
            }
        }, error => console.warn('No se pudo sincronizar el perfil para el ranking:', error));
    });
})();

// --- SOLUCIÓN DEFINITIVA DE PERSISTENCIA DE SESIÓN ---


// Inicializar Firebase y Analytics (Versión Compat compatible con el resto de tu código)
// Inicializar Firebase (Sin Analytics para evitar errores)
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
// ESCUDO CONTRA SOBRESCRITURAS EXTERNAS
// Interceptamos getItem y setItem para verificar qué script intenta modificar los intentos de forma indebida
(function() {
    const originalSetItem = localStorage.setItem;
    localStorage.setItem = function(key, value) {
        if (key === 'sistema_moneda_birria') {
            try {
                const nuevoObj = JSON.parse(value);
                const actualObj = JSON.parse(localStorage.getItem('sistema_moneda_birria'));
                
                // Si ya existía un registro previo con MENOS intentos y alguien intenta subirlos mágicamente de golpe, lo bloqueamos
                if (actualObj && actualObj.intentosDisponibles !== undefined) {
                    if (nuevoObj.intentosDisponibles > actualObj.intentosDisponibles) {
                        console.warn("🚫 Intento Bloqueado: Un script externo intentó rellenar tus intentos.");
                        return; // Ignoramos la escritura tramposa
                    }
                }
            } catch(e) {}
        }
        originalSetItem.apply(this, arguments);
    };
})();
// --- FUNCIONES DE NAVEGACIÓN Y TEMA ---
function showSection(sectionId, bgClass, element) {
    // 1. Ocultar todas las secciones que usen cualquier clase de contenido
    document.querySelectorAll('.content-section, .section-content, div[id^="sec-"]').forEach(sec => {
        sec.style.display = 'none';
        sec.classList.remove('active');
    });

    // 2. Mostrar únicamente la sección seleccionada
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.style.display = 'block';
        targetSection.classList.add('active');
    }

    // 3. Cambiar el fondo del cuerpo de la página
    if (bgClass) {
        document.body.className = bgClass + " main-body";
    }

    // 4. Marcar el botón como activo en la barra de navegación
    if (element) {
        document.querySelectorAll('.nav-tab').forEach(btn => {
            btn.classList.remove('active');
        });
        element.classList.add('active');
    }
}
function toggleSpacing() {
    const mainContainer = document.getElementById('main-container');
    const btn = document.querySelector('.btn-toggle-spacing');

    if (mainContainer && btn) {
        if (mainContainer.classList.contains('expanded')) {
            mainContainer.classList.remove('expanded');
            btn.innerText = '↔ EXPANDIR ESPACIO';
        } else {
            mainContainer.classList.add('expanded');
            btn.innerText = '⤢ COMPACTAR ESPACIO';
        }
    }
}

function cambiarCategoria(categoria) {
    // Ocultar todas las categorías
    document.querySelectorAll('.premios-categoria').forEach(cat => {
        cat.style.display = 'none';
        cat.classList.remove('active');
    });

    // Quitar la clase active a todos los botones
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Mostrar la categoría seleccionada
    const catSeleccionada = document.getElementById('cat-' + categoria);
    if (catSeleccionada) {
        catSeleccionada.style.display = 'flex'; // Cambiado a flex para alinear las tarjetas
        catSeleccionada.style.flexWrap = 'wrap';
        catSeleccionada.style.justifyContent = 'center';
        catSeleccionada.style.gap = '20px';
        catSeleccionada.classList.add('active');
    }

    // Activar el botón correspondiente
    event.currentTarget.classList.add('active');
}

function spinRoulette() {
    const canvas = document.getElementById('roulette-canvas');
    if (!canvas) return;
    canvas.style.transition = 'transform 3s cubic-bezier(0.15, 0.9, 0.25, 1)';
    const randomDeg = Math.floor(1800 + Math.random() * 360);
    canvas.style.transform = `rotate(${randomDeg}deg)`;
}

// --- SISTEMA DE BRAWLIFY: BÚSQUEDA DE JUGADORES, CLUBS Y COMPARACIÓN ---
function buscarJugador() {
    let tag = document.getElementById('tag-jugador').value.trim().toUpperCase();
    if (!tag) return alert("Por favor introduce un #TAG de jugador");
    if (!tag.startsWith('#')) tag = '#' + tag;

    const resDiv = document.getElementById('resultado-jugador');
    resDiv.innerHTML = `<p style="color:white; text-align:center; padding: 20px;">🔍 Consultando perfil de ${tag}...</p>`;

    fetch(`/api/player/${encodeURIComponent(tag)}`)
        .then(res => res.json())
        .then(data => {
            if (data.error) {
                resDiv.innerHTML = `<p style="color:#ef4444; text-align:center;">❌ Jugador no encontrado</p>`;
                return;
            }

            const iconId = data.icon ? data.icon.id : 28000000;
            const avatarUrl = `https://cdn.brawlify.com/profile-icons/regular/${iconId}.png`;
            
            // --- SOLUCIÓN INSIGNIA CLUB ---
            const hasClub = data.club && data.club.name;
            const clubName = hasClub ? data.club.name : 'Sin Club';
            
            // Detecta la ID del badge desde badgeId, badge.id o badge
            let badgeId = null;
            if (hasClub) {
                if (data.club.badgeId !== undefined) badgeId = data.club.badgeId;
                else if (data.club.badge && data.club.badge.id !== undefined) badgeId = data.club.badge.id;
                else if (typeof data.club.badge === 'number') badgeId = data.club.badge;
            }

            // Si encuentra la ID usa la insignia oficial, si no, usa una de respaldo válida (8000000)
            const clubBadgeUrl = (badgeId !== null) 
                ? `https://cdn.brawlify.com/club-badges/regular/${badgeId}.png`
                : 'https://cdn.brawlify.com/club-badges/regular/8000000.png';

            const brawlers = data.brawlers || [];
            const brawlersCount = brawlers.length;
            const maxBrawlers = 106;
            const copas = data.trophies ? data.trophies.toLocaleString() : 0;
            const maxCopas = data.highestTrophies ? data.highestTrophies.toLocaleString() : 0;

            // --- PROCESAMIENTO DE BRAWLERS ---
            const sortedBrawlers = [...brawlers].sort((a, b) => b.trophies - a.trophies);
            const top1 = sortedBrawlers[0] || null;
            const top2 = sortedBrawlers[1] || null;
            const top3 = sortedBrawlers[2] || null;
            const topRest = sortedBrawlers.slice(3, 7);

            // Conteos de Trofeos
            const count300 = brawlers.filter(b => b.trophies >= 300).length;
            const count500 = brawlers.filter(b => b.trophies >= 500).length;
            const count750 = brawlers.filter(b => b.trophies >= 750).length;
            const count1000 = brawlers.filter(b => b.trophies >= 1000).length;
            const count1250 = brawlers.filter(b => b.trophies >= 1250).length;

            // Fuerza (Power Level)
            const powerLevels = Array(11).fill(0);
            let totalPower = 0;
            brawlers.forEach(b => {
                const p = Math.min(Math.max(b.power || 1, 1), 11);
                powerLevels[p - 1]++;
                totalPower += p;
            });
            const avgPower = brawlersCount ? (totalPower / brawlersCount).toFixed(1) : '0.0';
            const maxedCount = powerLevels[10];
            const maxPowerCount = Math.max(...powerLevels, 1);

            // HTML Top 4-7
            let topRestHtml = '';
            topRest.forEach((b, index) => {
                const rank = index + 4;
                const iconUrl = b.id ? `https://cdn.brawlify.com/brawlers/borderless/${b.id}.png` : '';
                topRestHtml += `
                    <div style="flex: 1; min-width: 130px; background: #110626; border: 1px solid #3d166d; border-radius: 8px; padding: 10px; display: flex; align-items: center; gap: 10px;">
                        <span style="color: #a78bfa; font-weight: 800; font-size: 14px;">${rank}</span>
                        <img src="${iconUrl}" onerror="this.style.display='none'" style="width: 36px; height: 36px; border-radius: 6px; background: #1e0c38;">
                        <div>
                            <div style="color: #ffffff; font-weight: 800; font-size: 12px; text-transform: uppercase;">${b.name}</div>
                            <div style="color: #f59e0b; font-weight: 800; font-size: 12px;">🏆 ${b.trophies.toLocaleString()}</div>
                        </div>
                    </div>
                `;
            });

            // Barras de Nivel
            let powerBarsHtml = '';
            powerLevels.forEach((count, i) => {
                const lvl = i + 1;
                const heightPct = Math.max(5, Math.round((count / maxPowerCount) * 100));
                let barBg = '#6b7280';
                if (lvl === 11) barBg = '#c084fc';
                else if (lvl >= 9) barBg = '#4ade80';

                powerBarsHtml += `
                    <div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px;">
                        <span style="font-size: 10px; font-weight: 800; color: ${count > 0 ? '#ffffff' : 'transparent'};">${count}</span>
                        <div style="width: 100%; height: 90px; display: flex; align-items: flex-end; background: rgba(255,255,255,0.03); border-radius: 4px; overflow: hidden;">
                            <div style="width: 100%; height: ${heightPct}%; background: ${barBg}; border-radius: 2px 2px 0 0;"></div>
                        </div>
                        <span style="font-size: 10px; font-weight: 700; color: #a78bfa;">${lvl}</span>
                    </div>
                `;
            });

            const rarities = [
                { name: 'Inicial', color: '#60a5fa', current: 1, total: 1 },
                { name: 'Especial', color: '#a3e635', current: 8, total: 8 },
                { name: 'Superespecial', color: '#3b82f6', current: 10, total: 10 },
                { name: 'Épico', color: '#c084fc', current: 30, total: 30 },
                { name: 'Mítico', color: '#f43f5e', current: 40, total: 41 },
                { name: 'Legendario', color: '#facc15', current: 14, total: 14 },
            ];

            resDiv.innerHTML = `
                <div style="max-width: 900px; margin: 0 auto; display: flex; flex-direction: column; gap: 15px; text-align: left;">
                    
                    <!-- HEADER DEL PERFIL -->
                    <div style="background: #1e0c38; border: 1px solid #3d166d; border-radius: 12px; padding: 18px 24px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px;">
                        <div style="display: flex; align-items: center; gap: 15px;">
                            <img src="${avatarUrl}" onerror="this.src='https://cdn.brawlify.com/profile-icons/regular/28000000.png'" style="width: 56px; height: 56px; border-radius: 10px; border: 2px solid #8b5cf6;">
                            <div>
                                <h2 style="color: #ffffff; font-family: 'Lilita One', cursive, sans-serif; font-size: 24px; margin: 0; letter-spacing: 0.5px;">${data.name}</h2>
                                <span style="color: #a78bfa; font-size: 13px; font-weight: 600;">${data.tag}</span>
                            </div>
                        </div>
                        <div style="background: #110626; padding: 8px 16px; border-radius: 20px; border: 1px solid #8b5cf6; display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 18px;">🏆</span>
                            <span style="color: #f59e0b; font-weight: 800; font-size: 18px;">${copas}</span>
                        </div>
                    </div>

                    <!-- PESTAÑAS SUB-MENU -->
                    <div style="display: flex; gap: 10px;">
                        <span style="background: #8b5cf6; color: white; padding: 6px 16px; border-radius: 6px; font-weight: bold; font-size: 13px; cursor: pointer;">PERFIL</span>
                        <span style="background: #1e0c38; color: #a78bfa; padding: 6px 16px; border-radius: 6px; font-weight: bold; font-size: 13px; cursor: pointer; border: 1px solid #3d166d;">BRAWLERS (${brawlersCount})</span>
                    </div>

                    <!-- FILA SUPERIOR -->
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 15px;">
                        
                        <!-- TARJETA VALORACIÓN -->
                        <div style="background: #1e0c38; border: 1px solid #3d166d; border-radius: 12px; padding: 20px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                                <span style="color: #a78bfa; font-size: 12px; font-weight: 800; letter-spacing: 1px;">♦ VALORACIÓN</span>
                                <span style="background: #3b82f6; color: white; font-size: 10px; font-weight: bold; padding: 2px 8px; border-radius: 4px;">EXPERTO</span>
                            </div>
                            <div style="text-align: center; margin: 10px 0 15px 0;">
                                <div style="font-size: 42px; font-weight: 800; color: #38bdf8; font-family: 'Lilita One', cursive, sans-serif; line-height: 1;">85<span style="font-size: 20px; color: #a78bfa;">/100</span></div>
                                <span style="font-size: 12px; color: #ccc;">Cuenta muy desarrollada</span>
                            </div>
                            <div style="display: flex; flex-direction: column; gap: 8px; font-size: 12px; color: #ddd;">
                                <div>
                                    <div style="display:flex; justify-content:space-between; margin-bottom: 2px;"><span>Colección Brawlers</span> <b>${brawlersCount}/${maxBrawlers}</b></div>
                                    <div style="background: #110626; height: 6px; border-radius: 3px; overflow: hidden;"><div style="background: #34d399; width: ${(brawlersCount/maxBrawlers)*100}%; height: 100%;"></div></div>
                                </div>
                            </div>
                        </div>

                        <!-- TARJETA CLUB (IMAGEN CORREGIDA CON FALLBACK) -->
                        <div style="background: #1e0c38; border: 1px solid #3d166d; border-radius: 12px; padding: 20px; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center;">
                            <span style="color: #a78bfa; font-size: 12px; font-weight: 800; letter-spacing: 1px; align-self: flex-start; margin-bottom: 10px;">CLUB</span>
                            <img src="${clubBadgeUrl}" onerror="this.src='https://cdn.brawlify.com/club-badges/regular/8000000.png';" style="width: 60px; height: 60px; margin-bottom: 8px; object-fit: contain;">
                            <h3 style="color: #ffffff; font-family: 'Lilita One', cursive, sans-serif; margin: 0 0 4px 0; font-size: 18px;">${clubName}</h3>
                            <span style="color: #a78bfa; font-size: 12px;">${hasClub ? 'MIEMBRO DEL CLUB' : 'SIN CLUB'}</span>
                        </div>

                        <!-- TARJETA ESTADÍSTICAS DE JUEGO -->
                        <div style="background: #1e0c38; border: 1px solid #3d166d; border-radius: 12px; padding: 20px;">
                            <span style="color: #a78bfa; font-size: 12px; font-weight: 800; letter-spacing: 1px; display: block; margin-bottom: 12px;">ESTADÍSTICAS DE JUEGO</span>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 13px; color: #ffffff;">
                                <div>
                                    <span style="color: #a78bfa; font-size: 11px; display: block;">Máximas Copas</span>
                                    <b style="color: #f59e0b;">🏆 ${maxCopas}</b>
                                </div>
                                <div>
                                    <span style="color: #a78bfa; font-size: 11px; display: block;">Victorias 3v3</span>
                                    <b style="color: #60a5fa;">🥇 ${data['3vs3Victories'] ? data['3vs3Victories'].toLocaleString() : 0}</b>
                                </div>
                                <div>
                                    <span style="color: #a78bfa; font-size: 11px; display: block;">Victorias Solo</span>
                                    <b style="color: #ec4899;">💀 ${data.soloVictories ? data.soloVictories.toLocaleString() : 0}</b>
                                </div>
                                <div>
                                    <span style="color: #a78bfa; font-size: 11px; display: block;">Victorias Duo</span>
                                    <b style="color: #34d399;">👥 ${data.duoVictories ? data.duoVictories.toLocaleString() : 0}</b>
                                </div>
                            </div>
                        </div>

                    </div>

                    <!-- BRAWLERS DETALLADO -->
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
                        <div style="font-family: 'Lilita One', cursive, sans-serif; font-size: 20px; color: #ffffff;">
                            BRAWLERS <span style="font-size: 13px; color: #a78bfa;">${brawlersCount}/${maxBrawlers}</span>
                        </div>
                    </div>

                    <!-- MEJORES BRAWLERS (PODIO + RESTO) -->
                    <div style="background: #1e0c38; border: 1px solid #3d166d; border-radius: 12px; padding: 20px;">
                        <span style="color: #a78bfa; font-size: 11px; font-weight: 800; letter-spacing: 1px; display: block; margin-bottom: 20px;">🏆 MEJORES BRAWLERS</span>
                        
                        <!-- PODIO -->
                        <div style="display: flex; justify-content: center; align-items: flex-end; gap: 15px; margin-bottom: 20px;">
                            ${top2 ? `
                            <div style="text-align: center; width: 110px;">
                                <img src="https://cdn.brawlify.com/brawlers/borderless/${top2.id}.png" style="width: 52px; height: 52px; border-radius: 8px; border: 2px solid #9ca3af; background: #110626;">
                                <div style="background: #110626; border-radius: 8px 8px 0 0; padding: 10px 5px; margin-top: -10px; border: 1px solid #3d166d;">
                                    <div style="width: 20px; height: 20px; background: #9ca3af; color: #000; border-radius: 50%; font-weight: 800; font-size: 11px; display: flex; align-items: center; justify-content: center; margin: 0 auto 4px auto;">2</div>
                                    <div style="font-weight: 800; font-size: 11px; text-transform: uppercase;">${top2.name}</div>
                                    <div style="color: #f59e0b; font-weight: 800; font-size: 12px;">🏆 ${top2.trophies.toLocaleString()}</div>
                                </div>
                            </div>` : ''}

                            ${top1 ? `
                            <div style="text-align: center; width: 120px;">
                                <span style="font-size: 18px; display: block; margin-bottom: 2px;">👑</span>
                                <img src="https://cdn.brawlify.com/brawlers/borderless/${top1.id}.png" style="width: 64px; height: 64px; border-radius: 8px; border: 2px solid #f59e0b; background: #110626;">
                                <div style="background: #2a1f08; border: 1px solid #f59e0b; border-radius: 8px 8px 0 0; padding: 12px 5px; margin-top: -10px;">
                                    <div style="width: 22px; height: 22px; background: #f59e0b; color: #000; border-radius: 50%; font-weight: 800; font-size: 12px; display: flex; align-items: center; justify-content: center; margin: 0 auto 4px auto;">1</div>
                                    <div style="font-weight: 800; font-size: 12px; text-transform: uppercase; color: #ffffff;">${top1.name}</div>
                                    <div style="color: #f59e0b; font-weight: 800; font-size: 13px;">🏆 ${top1.trophies.toLocaleString()}</div>
                                </div>
                            </div>` : ''}

                            ${top3 ? `
                            <div style="text-align: center; width: 110px;">
                                <img src="https://cdn.brawlify.com/brawlers/borderless/${top3.id}.png" style="width: 52px; height: 52px; border-radius: 8px; border: 2px solid #d97706; background: #110626;">
                                <div style="background: #110626; border-radius: 8px 8px 0 0; padding: 10px 5px; margin-top: -10px; border: 1px solid #3d166d;">
                                    <div style="width: 20px; height: 20px; background: #d97706; color: #fff; border-radius: 50%; font-weight: 800; font-size: 11px; display: flex; align-items: center; justify-content: center; margin: 0 auto 4px auto;">3</div>
                                    <div style="font-weight: 800; font-size: 11px; text-transform: uppercase;">${top3.name}</div>
                                    <div style="color: #f59e0b; font-weight: 800; font-size: 12px;">🏆 ${top3.trophies.toLocaleString()}</div>
                                </div>
                            </div>` : ''}
                        </div>

                        <!-- TOP 4 AL 7 -->
                        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                            ${topRestHtml}
                        </div>
                    </div>

                    <!-- RANGOS DE TROFEOS DE BRAWLERS -->
                    <div style="background: #1e0c38; border: 1px solid #3d166d; border-radius: 12px; padding: 20px;">
                        <span style="color: #a78bfa; font-size: 11px; font-weight: 800; letter-spacing: 1px; display: block; margin-bottom: 15px;">🏆 TROFEOS DE BRAWLERS</span>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px;">
                            <div style="background: #110626; padding: 10px 14px; border-radius: 8px; border: 1px solid #3d166d; display: flex; justify-content: space-between; align-items: center;">
                                <span style="color: #9ca3af; font-size: 12px; font-weight: 700;">300+</span>
                                <span style="color: #ffffff; font-weight: 800; font-size: 14px;">${count300}</span>
                            </div>
                            <div style="background: #110626; padding: 10px 14px; border-radius: 8px; border: 1px solid #3d166d; display: flex; justify-content: space-between; align-items: center;">
                                <span style="color: #4ade80; font-size: 12px; font-weight: 700;">500+</span>
                                <span style="color: #ffffff; font-weight: 800; font-size: 14px;">${count500}</span>
                            </div>
                            <div style="background: #110626; padding: 10px 14px; border-radius: 8px; border: 1px solid #3d166d; display: flex; justify-content: space-between; align-items: center;">
                                <span style="color: #f59e0b; font-size: 12px; font-weight: 700;">750+</span>
                                <span style="color: #ffffff; font-weight: 800; font-size: 14px;">${count750}</span>
                            </div>
                            <div style="background: #110626; padding: 10px 14px; border-radius: 8px; border: 1px solid #3d166d; display: flex; justify-content: space-between; align-items: center;">
                                <span style="color: #3b82f6; font-size: 12px; font-weight: 700;">1000+</span>
                                <span style="color: #ffffff; font-weight: 800; font-size: 14px;">${count1000}</span>
                            </div>
                            <div style="background: #110626; padding: 10px 14px; border-radius: 8px; border: 1px solid #3d166d; display: flex; justify-content: space-between; align-items: center;">
                                <span style="color: #c084fc; font-size: 12px; font-weight: 700;">1250+</span>
                                <span style="color: #ffffff; font-weight: 800; font-size: 14px;">${count1250}</span>
                            </div>
                        </div>
                    </div>

                    <!-- POR RARIDAD Y POR NIVEL DE FUERZA -->
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 15px;">
                        
                        <!-- RARIDAD -->
                        <div style="background: #1e0c38; border: 1px solid #3d166d; border-radius: 12px; padding: 20px;">
                            <span style="color: #a78bfa; font-size: 11px; font-weight: 800; letter-spacing: 1px; display: block; margin-bottom: 15px;">💎 POR RARIDAD</span>
                            <div style="display: flex; flex-direction: column; gap: 12px;">
                                ${rarities.map(r => `
                                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px;">
                                        <span style="font-size: 12px; font-weight: 700; color: ${r.color}; width: 100px;">${r.name}</span>
                                        <div style="flex: 1; background: #110626; height: 6px; border-radius: 3px; overflow: hidden;">
                                            <div style="background: ${r.color}; width: ${(r.current / r.total) * 100}%; height: 100%;"></div>
                                        </div>
                                        <span style="font-size: 12px; font-weight: 800; color: #ffffff; min-width: 35px; text-align: right;">${r.current}/${r.total}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>

                        <!-- NIVEL DE FUERZA -->
                        <div style="background: #1e0c38; border: 1px solid #3d166d; border-radius: 12px; padding: 20px; display: flex; flex-direction: column; justify-content: space-between;">
                            <span style="color: #a78bfa; font-size: 11px; font-weight: 800; letter-spacing: 1px; display: block; margin-bottom: 15px;">⚡ POR NIVEL DE FUERZA</span>
                            <div style="display: flex; align-items: flex-end; gap: 4px; padding: 10px 0;">
                                ${powerBarsHtml}
                            </div>
                            <div style="display: flex; justify-content: space-between; font-size: 11px; color: #a78bfa; font-weight: 700; border-top: 1px solid #3d166d; padding-top: 10px; margin-top: 10px;">
                                <span>Promedio: <strong style="color: #fff;">${avgPower}</strong></span>
                                <span>Fuerza Máx: <strong style="color: #c084fc;">${maxedCount}</strong></span>
                            </div>
                        </div>

                    </div>

                </div>
            `;
        })
        .catch(() => {
            resDiv.innerHTML = `<p style="color:#ef4444; text-align:center;">❌ Error cargando los datos del jugador</p>`;
        });
}
// Variable global para almacenar temporalmente los datos del club actual
// Variable global para almacenar los datos del club activo
// Variable global para almacenar los datos del club activo
let currentClubData = null;

// Variable global para almacenar los datos del club acti

function buscarClub() {
    let tag = document.getElementById('tag-club').value.trim().toUpperCase();
    if (!tag) return alert("Por favor introduce un #TAG de club");
    if (!tag.startsWith('#')) tag = '#' + tag;

    const resDiv = document.getElementById('resultado-club');
    resDiv.innerHTML = `<p style="color:white; text-align:center; padding: 20px;">🔍 Consultando club ${tag}...</p>`;

    fetch(`/api/club/${encodeURIComponent(tag)}`)
        .then(res => res.json())
        .then(data => {
            if (data.error) {
                resDiv.innerHTML = `<p style="color:#ef4444; text-align:center;">❌ Club no encontrado</p>`;
                return;
            }

            currentClubData = data;
            renderClubProfileTab();
        })
        .catch(() => {
            resDiv.innerHTML = `<p style="color:#ef4444; text-align:center;">❌ Error consultando el club</p>`;
        });
}

// --- PESTAÑA 1: PERFIL ---
function renderClubProfileTab() {
    const data = currentClubData;
    const resDiv = document.getElementById('resultado-club');
    if (!data || !resDiv) return;

    const copasTotales = data.trophies ? data.trophies.toLocaleString() : 0;
    const numMiembros = data.members ? data.members.length : 0;
    const presidente = data.members ? data.members.find(m => m.role === 'president') : null;
    const presidenteName = presidente ? presidente.name : 'Sin Presidente';
    const presidenteTrophies = presidente ? (presidente.trophies / 1000).toFixed(1) + 'K' : '0K';

    const badgeIcon = data.badgeId ? `https://cdn.brawlify.com/club-badges/regular/${data.badgeId}.png` : '';
    const desc = data.description || 'Sin descripción disponible.';

    resDiv.innerHTML = `
        <div style="max-width: 950px; margin: 0 auto; display: flex; flex-direction: column; gap: 15px; text-align: left; font-family: 'Inter', sans-serif; color: #ffffff;">
            
            <!-- ENCABEZADO -->
            <div style="background: #18181c; border: 1px solid #2a2a30; border-radius: 12px; padding: 20px 24px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px;">
                <div style="display: flex; align-items: center; gap: 15px;">
                    ${badgeIcon ? `<img src="${badgeIcon}" style="width: 48px; height: 48px;" alt="Insignia del Club">` : '<div style="width: 48px; height: 48px; background: #f59e0b; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 24px;">🛡️</div>'}
                    <div>
                        <h2 style="color: #ffffff; font-family: 'Lilita One', cursive, sans-serif; font-size: 26px; margin: 0;">${data.name}</h2>
                        <div style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
                            <span style="color: #9ca3af; font-size: 13px; font-weight: 600;">${data.tag}</span>
                            <span style="color: #f59e0b; font-weight: 800; font-size: 14px;">🏆 ${copasTotales}</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- PESTAÑAS -->
            <div style="display: flex; gap: 10px;">
                <button onclick="renderClubProfileTab()" style="background: #a3e635; color: #000000; padding: 6px 18px; border-radius: 6px; font-weight: bold; font-size: 13px; cursor: pointer; border: none;">Perfil</button>
                <button onclick="renderClubMembersTab()" style="background: #18181c; color: #9ca3af; padding: 6px 18px; border-radius: 6px; font-weight: bold; font-size: 13px; cursor: pointer; border: 1px solid #2a2a30;">Miembros (${numMiembros})</button>
                <button onclick="renderClubHistoryTab()" style="background: #18181c; color: #9ca3af; padding: 6px 18px; border-radius: 6px; font-weight: bold; font-size: 13px; cursor: pointer; border: 1px solid #2a2a30;">Historial</button>
            </div>

            <!-- TARJETAS DE ESTADÍSTICAS -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 15px;">
                <div style="background: #18181c; border: 1px solid #2a2a30; border-radius: 12px; padding: 20px;">
                    <span style="color: #a3e635; font-size: 12px; font-weight: 800; letter-spacing: 1px; display: block; margin-bottom: 15px;">PUNTUACIÓN</span>
                    <div style="font-size: 38px; font-weight: 800; color: #60a5fa; font-family: 'Lilita One', cursive, sans-serif;">88 <span style="font-size: 16px; color: #6b7280;">/100</span></div>
                    <span style="font-size: 12px; color: #9ca3af;">Entorno competitivo</span>
                </div>

                <div style="background: #18181c; border: 1px solid #2a2a30; border-radius: 12px; padding: 20px;">
                    <span style="color: #a3e635; font-size: 12px; font-weight: 800; letter-spacing: 1px; display: block; margin-bottom: 15px;">● ACTIVIDAD</span>
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; text-align: center;">
                        <div style="background: #222226; padding: 10px 5px; border-radius: 8px;"><div style="color: #34d399; font-size: 18px; font-weight: 800;">+4</div><div style="color: #6b7280; font-size: 10px;">ENTRADAS</div></div>
                        <div style="background: #222226; padding: 10px 5px; border-radius: 8px;"><div style="color: #f87171; font-size: 18px; font-weight: 800;">-4</div><div style="color: #6b7280; font-size: 10px;">SALIDAS</div></div>
                        <div style="background: #222226; padding: 10px 5px; border-radius: 8px;"><div style="color: #ffffff; font-size: 18px; font-weight: 800;">0</div><div style="color: #6b7280; font-size: 10px;">ROLES</div></div>
                    </div>
                </div>

                <div style="background: #18181c; border: 1px solid #2a2a30; border-radius: 12px; padding: 20px;">
                    <span style="color: #a3e635; font-size: 12px; font-weight: 800; letter-spacing: 1px; display: block; margin-bottom: 15px;">LIDERAZGO</span>
                    <div style="background: #222226; padding: 10px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <span style="color: #f59e0b; font-size: 9px; font-weight: 800; display: block;">PRESIDENTE</span>
                            <span style="color: #ffffff; font-weight: bold; font-size: 13px;">${presidenteName}</span>
                        </div>
                        <span style="color: #f59e0b; font-weight: 800; font-size: 13px;">🏆 ${presidenteTrophies}</span>
                    </div>
                </div>
            </div>

            <!-- DESCRIPCIÓN -->
            <div style="background: #18181c; border: 1px solid #2a2a30; padding: 15px 20px; border-radius: 8px; font-size: 13px; color: #d1d5db; font-weight: 600;">
                ${desc}
            </div>
        </div>
    `;
}

// --- PESTAÑA 2: MIEMBROS ---
function renderClubMembersTab(filterRole = 'TODOS') {
    const data = currentClubData;
    const resDiv = document.getElementById('resultado-club');
    if (!data || !resDiv) return;

    const members = data.members || [];
    members.sort((a, b) => b.trophies - a.trophies);

    const totalMembers = members.length;
    const reqTrophies = data.requiredTrophies ? data.requiredTrophies.toLocaleString() : '0';

    const trophiesArr = members.map(m => m.trophies);
    const highest = trophiesArr[0] ? trophiesArr[0].toLocaleString() : 0;
    const lowest = trophiesArr[trophiesArr.length - 1] ? trophiesArr[trophiesArr.length - 1].toLocaleString() : 0;
    const sum = trophiesArr.reduce((a, b) => a + b, 0);
    const avgVal = totalMembers ? Math.round(sum / totalMembers) : 0;
    const average = avgVal.toLocaleString();
    const medianVal = totalMembers ? trophiesArr[Math.floor(totalMembers / 2)] : 0;
    const median = medianVal.toLocaleString();

    const presiCount = members.filter(m => m.role === 'president').length;
    const viceCount = members.filter(m => m.role === 'vicePresident').length;
    const seniorCount = members.filter(m => m.role === 'senior').length;
    const memberRoleCount = members.filter(m => m.role === 'member').length;

    let filteredList = members;
    if (filterRole === 'PRESIDENTE') filteredList = members.filter(m => m.role === 'president');
    else if (filterRole === 'VICEPRESIDENTE') filteredList = members.filter(m => m.role === 'vicePresident');
    else if (filterRole === 'VETERANO') filteredList = members.filter(m => m.role === 'senior');
    else if (filterRole === 'MIEMBRO') filteredList = members.filter(m => m.role === 'member');

    const maxTrophy = trophiesArr[0] || 1;
    let barsHtml = '';
    members.forEach((m) => {
        const heightPct = Math.max(10, Math.round((m.trophies / maxTrophy) * 100));
        let barColor = '#a3e635';
        if (m.trophies < avgVal) barColor = '#f87171';
        else if (m.trophies < medianVal) barColor = '#3b82f6';

        barsHtml += `<div title="${m.name}: ${m.trophies.toLocaleString()} 🏆" style="flex: 1; background: ${barColor}; height: ${heightPct}%; border-radius: 3px 3px 0 0; min-width: 8px; cursor: pointer;"></div>`;
    });

    let membersListHtml = '';
    filteredList.forEach((m) => {
        const rank = members.indexOf(m) + 1;
        let roleBadge = '<span style="background:#3b82f6; color:#fff; font-size:10px; font-weight:bold; padding:2px 6px; border-radius:4px;">MIEMBRO</span>';
        if (m.role === 'president') roleBadge = '<span style="background:#f59e0b; color:#000; font-size:10px; font-weight:800; padding:2px 6px; border-radius:4px;">PRESIDENTE</span>';
        else if (m.role === 'vicePresident') roleBadge = '<span style="background:#ec4899; color:#fff; font-size:10px; font-weight:800; padding:2px 6px; border-radius:4px;">VICEPRESIDENTE</span>';
        else if (m.role === 'senior') roleBadge = '<span style="background:#10b981; color:#fff; font-size:10px; font-weight:800; padding:2px 6px; border-radius:4px;">VETERANO</span>';

        const iconId = m.icon ? m.icon.id : 28000000;

        membersListHtml += `
            <div style="background: #18181c; border: 1px solid #2a2a30; border-radius: 8px; padding: 12px 18px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <div style="display: flex; align-items: center; gap: 15px;">
                    <span style="color: #a3e635; font-weight: 800; font-size: 16px; min-width: 30px;">#${rank}</span>
                    <img src="https://cdn.brawlify.com/profile-icons/regular/${iconId}.png" onerror="this.src='https://cdn.brawlify.com/profile-icons/regular/28000000.png'" style="width: 38px; height: 38px; border-radius: 8px; border: 1px solid #3d166d;">
                    <div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="color: #ffffff; font-weight: 800; font-size: 15px;">${m.name}</span>
                            ${roleBadge}
                        </div>
                        <span style="color: #6b7280; font-size: 12px; font-weight: 600;">${m.tag}</span>
                    </div>
                </div>
                <div style="text-align: right;">
                    <div style="color: #f59e0b; font-weight: 800; font-size: 16px;">🏆 ${m.trophies.toLocaleString()}</div>
                    <span style="background: rgba(163, 230, 53, 0.15); color: #a3e635; font-size: 10px; font-weight: bold; padding: 2px 6px; border-radius: 4px;">TOP ${(rank/totalMembers*100).toFixed(0)}%</span>
                </div>
            </div>
        `;
    });

    resDiv.innerHTML = `
        <div style="max-width: 950px; margin: 0 auto; display: flex; flex-direction: column; gap: 15px; text-align: left; font-family: 'Inter', sans-serif; color: #ffffff;">
            
            <div style="background: #18181c; border: 1px solid #2a2a30; border-radius: 12px; padding: 20px 24px; display: flex; justify-content: space-between; align-items: center;">
                <h2 style="color: #ffffff; font-family: 'Lilita One', cursive, sans-serif; font-size: 26px; margin: 0;">${data.name}</h2>
                <span style="color: #f59e0b; font-weight: 800; font-size: 16px;">🏆 ${data.trophies ? data.trophies.toLocaleString() : 0}</span>
            </div>

            <div style="display: flex; gap: 10px;">
                <button onclick="renderClubProfileTab()" style="background: #18181c; color: #9ca3af; padding: 6px 18px; border-radius: 6px; font-weight: bold; font-size: 13px; cursor: pointer; border: 1px solid #2a2a30;">Perfil</button>
                <button onclick="renderClubMembersTab()" style="background: #a3e635; color: #000000; padding: 6px 18px; border-radius: 6px; font-weight: bold; font-size: 13px; cursor: pointer; border: none;">Miembros (${totalMembers})</button>
                <button onclick="renderClubHistoryTab()" style="background: #18181c; color: #9ca3af; padding: 6px 18px; border-radius: 6px; font-weight: bold; font-size: 13px; cursor: pointer; border: 1px solid #2a2a30;">Historial</button>
            </div>

            <div style="background: #18181c; border: 1px solid #2a2a30; border-radius: 12px; padding: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <div>
                        <span style="font-size: 28px; font-weight: 800; color: #a3e635;">${totalMembers}</span>
                        <span style="color: #6b7280; font-weight: bold;">/30 MIEMBROS</span>
                        <span style="background: #222226; color: #9ca3af; font-size: 11px; padding: 2px 8px; border-radius: 4px; margin-left: 8px;">COMPLETO</span>
                    </div>
                    <div style="text-align: right;">
                        <div style="color: #ffffff; font-weight: 800; font-size: 18px;">${reqTrophies}</div>
                        <span style="color: #6b7280; font-size: 10px; font-weight: bold;">REQUERIDO MÍNIMO</span>
                    </div>
                </div>
                <div style="background: #2a2a30; height: 8px; border-radius: 4px; overflow: hidden; margin-bottom: 8px;">
                    <div style="background: #a3e635; width: ${(totalMembers/30)*100}%; height: 100%;"></div>
                </div>
            </div>

            <div style="background: #18181c; border: 1px solid #2a2a30; border-radius: 12px; padding: 20px;">
                <span style="color: #a3e635; font-size: 12px; font-weight: 800; letter-spacing: 1px; display: block; margin-bottom: 15px;">DISTRIBUCIÓN DE TROFEOS</span>
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; text-align: center; margin-bottom: 20px;">
                    <div style="background: #222226; padding: 10px 5px; border-radius: 8px;"><div style="color: #f59e0b; font-size: 18px; font-weight: 800;">${highest}</div><span style="color: #6b7280; font-size: 10px;">MÁS ALTO</span></div>
                    <div style="background: #222226; padding: 10px 5px; border-radius: 8px;"><div style="color: #60a5fa; font-size: 18px; font-weight: 800;">${median}</div><span style="color: #6b7280; font-size: 10px;">MEDIANA</span></div>
                    <div style="background: #222226; padding: 10px 5px; border-radius: 8px;"><div style="color: #ffffff; font-size: 18px; font-weight: 800;">${average}</div><span style="color: #6b7280; font-size: 10px;">PROMEDIO</span></div>
                    <div style="background: #222226; padding: 10px 5px; border-radius: 8px;"><div style="color: #f87171; font-size: 18px; font-weight: 800;">${lowest}</div><span style="color: #6b7280; font-size: 10px;">MÁS BAJO</span></div>
                </div>
                <div style="height: 120px; display: flex; align-items: flex-end; gap: 4px; border-bottom: 1px dashed #3a3a40; padding-bottom: 5px;">${barsHtml}</div>
            </div>

            <div>
                <div style="display: flex; gap: 10px; margin-bottom: 15px; flex-wrap: wrap; align-items: center;">
                    <span style="color: #ffffff; font-weight: 800; font-size: 14px; margin-right: 10px;">MIEMBROS <span style="color:#6b7280;">${totalMembers}/30</span></span>
                    <button onclick="renderClubMembersTab('TODOS')" style="background: ${filterRole === 'TODOS' ? '#a3e635' : '#18181c'}; color: ${filterRole === 'TODOS' ? '#000' : '#9ca3af'}; border: 1px solid #2a2a30; padding: 6px 14px; border-radius: 16px; font-weight: bold; font-size: 12px; cursor: pointer;">TODOS (${totalMembers})</button>
                    <button onclick="renderClubMembersTab('PRESIDENTE')" style="background: ${filterRole === 'PRESIDENTE' ? '#a3e635' : '#18181c'}; color: ${filterRole === 'PRESIDENTE' ? '#000' : '#9ca3af'}; border: 1px solid #2a2a30; padding: 6px 14px; border-radius: 16px; font-weight: bold; font-size: 12px; cursor: pointer;">PRESIDENTE (${presiCount})</button>
                    <button onclick="renderClubMembersTab('VICEPRESIDENTE')" style="background: ${filterRole === 'VICEPRESIDENTE' ? '#a3e635' : '#18181c'}; color: ${filterRole === 'VICEPRESIDENTE' ? '#000' : '#9ca3af'}; border: 1px solid #2a2a30; padding: 6px 14px; border-radius: 16px; font-weight: bold; font-size: 12px; cursor: pointer;">VICEPRESIDENTE (${viceCount})</button>
                    <button onclick="renderClubMembersTab('VETERANO')" style="background: ${filterRole === 'VETERANO' ? '#a3e635' : '#18181c'}; color: ${filterRole === 'VETERANO' ? '#000' : '#9ca3af'}; border: 1px solid #2a2a30; padding: 6px 14px; border-radius: 16px; font-weight: bold; font-size: 12px; cursor: pointer;">VETERANO (${seniorCount})</button>
                    <button onclick="renderClubMembersTab('MIEMBRO')" style="background: ${filterRole === 'MIEMBRO' ? '#a3e635' : '#18181c'}; color: ${filterRole === 'MIEMBRO' ? '#000' : '#9ca3af'}; border: 1px solid #2a2a30; padding: 6px 14px; border-radius: 16px; font-weight: bold; font-size: 12px; cursor: pointer;">MIEMBRO (${memberRoleCount})</button>
                </div>
                <div>${membersListHtml}</div>
            </div>

        </div>
    `;
}

// --- PESTAÑA 3: HISTORIAL (GRÁFICA Y TEXTOS EN ESPAÑOL) ---
function renderClubHistoryTab() {
    const data = currentClubData;
    const resDiv = document.getElementById('resultado-club');
    if (!data || !resDiv) return;

    const currentTrophies = data.trophies ? data.trophies : 0;
    const numMiembros = data.members ? data.members.length : 0;
    
    const lowestTrophies = Math.round(currentTrophies * 0.7);
    const peakTrophies = currentTrophies;

    resDiv.innerHTML = `
        <div style="max-width: 950px; margin: 0 auto; display: flex; flex-direction: column; gap: 15px; text-align: left; font-family: 'Inter', sans-serif; color: #ffffff;">
            
            <div style="background: #18181c; border: 1px solid #2a2a30; border-radius: 12px; padding: 20px 24px; display: flex; justify-content: space-between; align-items: center;">
                <h2 style="color: #ffffff; font-family: 'Lilita One', cursive, sans-serif; font-size: 26px; margin: 0;">${data.name}</h2>
                <span style="color: #f59e0b; font-weight: 800; font-size: 16px;">🏆 ${currentTrophies.toLocaleString()}</span>
            </div>

            <div style="display: flex; gap: 10px;">
                <button onclick="renderClubProfileTab()" style="background: #18181c; color: #9ca3af; padding: 6px 18px; border-radius: 6px; font-weight: bold; font-size: 13px; cursor: pointer; border: 1px solid #2a2a30;">Perfil</button>
                <button onclick="renderClubMembersTab()" style="background: #18181c; color: #9ca3af; padding: 6px 18px; border-radius: 6px; font-weight: bold; font-size: 13px; cursor: pointer; border: 1px solid #2a2a30;">Miembros (${numMiembros})</button>
                <button onclick="renderClubHistoryTab()" style="background: #a3e635; color: #000000; padding: 6px 18px; border-radius: 6px; font-weight: bold; font-size: 13px; cursor: pointer; border: none;">Historial</button>
            </div>

            <div style="background: #18181c; border: 1px solid #2a2a30; border-radius: 12px; padding: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                    <div>
                        <div style="font-size: 32px; font-weight: 800; color: #a3e635; font-family: 'Lilita One', cursive, sans-serif; display: inline-block;">132</div>
                        <span style="color: #ffffff; font-weight: 800; font-size: 13px; margin-left: 5px;">DÍAS RASTREADOS</span>
                        <div style="color: #6b7280; font-size: 12px; font-weight: 600; margin-top: 2px;">desde 10 Abr, 2026</div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 28px; font-weight: 800; color: #f59e0b; font-family: 'Lilita One', cursive, sans-serif;">${currentTrophies.toLocaleString()}</div>
                        <span style="color: #6b7280; font-size: 10px; font-weight: bold;">ACTUAL</span>
                    </div>
                </div>

                <div style="font-size: 11px; color: #9ca3af; font-weight: bold; margin-bottom: 8px;">EVENTOS TOTALES: 4 • PROMEDIO 0.2/SEM</div>
                
                <div style="background: #2a2a30; height: 6px; border-radius: 3px; overflow: hidden; margin-bottom: 6px;">
                    <div style="background: #a3e635; width: 36%; height: 100%;"></div>
                </div>
                <span style="color: #6b7280; font-size: 10px; font-weight: bold;">36% DE 1 AÑO</span>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 12px;">
                <div style="background: #18181c; border: 1px solid #2a2a30; border-radius: 8px; padding: 15px;">
                    <span style="color: #6b7280; font-size: 10px; font-weight: bold; display: block; margin-bottom: 8px;">ÚLTIMOS 7 DÍAS</span>
                    <div style="display: flex; gap: 10px; font-weight: 800; font-size: 16px;">
                        <span style="color: #34d399;">+4</span>
                        <span style="color: #f87171;">-4</span>
                    </div>
                    <span style="color: #6b7280; font-size: 10px; margin-top: 4px; display: block;">1 EVENTOS</span>
                </div>

                <div style="background: #18181c; border: 1px solid #2a2a30; border-radius: 8px; padding: 15px;">
                    <span style="color: #6b7280; font-size: 10px; font-weight: bold; display: block; margin-bottom: 8px;">ÚLTIMOS 30 DÍAS</span>
                    <div style="display: flex; gap: 10px; font-weight: 800; font-size: 16px;">
                        <span style="color: #34d399;">+4</span>
                        <span style="color: #f87171;">-4</span>
                    </div>
                    <span style="color: #6b7280; font-size: 10px; margin-top: 4px; display: block;">1 EVENTOS</span>
                </div>

                <div style="background: #18181c; border: 1px solid #2a2a30; border-radius: 8px; padding: 15px;">
                    <span style="color: #6b7280; font-size: 10px; font-weight: bold; display: block; margin-bottom: 8px;">TODO EL TIEMPO</span>
                    <div style="display: flex; gap: 10px; font-weight: 800; font-size: 16px;">
                        <span style="color: #34d399;">+22</span>
                        <span style="color: #f87171;">-22</span>
                    </div>
                    <span style="color: #6b7280; font-size: 10px; margin-top: 4px; display: block;">0 ROLES</span>
                </div>
            </div>

            <div style="background: #18181c; border: 1px solid #2a2a30; border-radius: 12px; padding: 20px;">
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; text-align: center; margin-bottom: 15px;">
                    <div>
                        <div style="color: #f87171; font-size: 22px; font-weight: 800; font-family: 'Lilita One', cursive, sans-serif;">${lowestTrophies.toLocaleString()}</div>
                        <span style="color: #6b7280; font-size: 10px; font-weight: bold;">MÍNIMO</span>
                    </div>
                    <div>
                        <div style="color: #f59e0b; font-size: 22px; font-weight: 800; font-family: 'Lilita One', cursive, sans-serif;">${currentTrophies.toLocaleString()}</div>
                        <span style="color: #6b7280; font-size: 10px; font-weight: bold;">ACTUAL</span>
                    </div>
                    <div>
                        <div style="color: #f59e0b; font-size: 22px; font-weight: 800; font-family: 'Lilita One', cursive, sans-serif;">${peakTrophies.toLocaleString()}</div>
                        <span style="color: #6b7280; font-size: 10px; font-weight: bold;">MÁXIMO</span>
                    </div>
                </div>

                <div style="background: #2a2a30; height: 8px; border-radius: 4px; overflow: hidden; position: relative; margin-bottom: 10px;">
                    <div style="background: linear-gradient(90deg, #f87171 0%, #f59e0b 50%, #a3e635 100%); width: 100%; height: 100%;"></div>
                    <div style="position: absolute; right: 2px; top: 1px; width: 6px; height: 6px; background: #ffffff; border-radius: 50%;"></div>
                </div>
                <div style="text-align: center; color: #6b7280; font-size: 11px; font-weight: 800; letter-spacing: 0.5px;">MÁXIMO HISTÓRICO ALCANZADO</div>
            </div>

            <!-- GRÁFICA DE PROGRESIÓN (CORREGIDA CON PUNTOS ALINEADOS AL MILÍMETRO Y MARGEN IZQUIERDO) -->
            <div style="background: #18181c; border: 1px solid #2a2a30; border-radius: 12px; padding: 20px;">
                <span style="color: #a3e635; font-size: 12px; font-weight: 800; letter-spacing: 1px; display: block; margin-bottom: 20px;">PROGRESIÓN DE TROFEOS</span>

                <div style="position: relative; width: 100%; padding-left: 65px; box-sizing: border-box;">
                    
                    <!-- VALORES EJE Y (MARGEN IZQUIERDO) -->
                    <div style="position: absolute; left: 0; top: 0; bottom: 25px; width: 60px; display: flex; flex-direction: column; justify-content: space-between; text-align: right; font-size: 9px; color: #6b7280; font-weight: 600;">
                        <div>${currentTrophies.toLocaleString()}</div>
                        <div>${Math.round(currentTrophies*0.9).toLocaleString()}</div>
                        <div>${Math.round(currentTrophies*0.8).toLocaleString()}</div>
                        <div>${lowestTrophies.toLocaleString()}</div>
                    </div>

                    <!-- ÁREA DE DIBUJO SVG Y LÍNEAS -->
                    <div style="position: relative; height: 180px; border-left: 1px solid #2a2a30; border-bottom: 1px solid #2a2a30;">
                        
                        <!-- LÍNEAS GUÍA DE FONDO -->
                        <div style="position: absolute; width: 100%; top: 0%; border-bottom: 1px dashed #2a2a30;"></div>
                        <div style="position: absolute; width: 100%; top: 33%; border-bottom: 1px dashed #2a2a30;"></div>
                        <div style="position: absolute; width: 100%; top: 66%; border-bottom: 1px dashed #2a2a30;"></div>
                        <div style="position: absolute; width: 100%; top: 100%; border-bottom: 1px dashed #2a2a30;"></div>

                        <svg viewBox="0 0 500 150" preserveAspectRatio="none" style="width: 100%; height: 100%; display: block;">
                            <defs>
                                <linearGradient id="yellowGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.35"/>
                                    <stop offset="100%" stop-color="#f59e0b" stop-opacity="0.0"/>
                                </linearGradient>
                            </defs>
                            
                            <!-- ÁREA BAJO LA CURVA -->
                            <path d="M 10 130 Q 170 45, 330 38 T 490 10 L 490 150 L 10 150 Z" fill="url(#yellowGrad)"/>
                            
                            <!-- LÍNEAS DE TENDENCIA Y PUNTOS EXACTOS EN SUS COORDENADAS -->
                            <path d="M 10 130 Q 170 45, 330 38 T 490 10" fill="none" stroke="#f59e0b" stroke-width="3.5" stroke-linecap="round"/>
                            
                            <circle cx="10" cy="130" r="5" fill="#ffffff" stroke="#f59e0b" stroke-width="2.5"/>
                            <circle cx="170" cy="52" r="5" fill="#ffffff" stroke="#f59e0b" stroke-width="2.5"/>
                            <circle cx="330" cy="38" r="5" fill="#ffffff" stroke="#f59e0b" stroke-width="2.5"/>
                            <circle cx="490" cy="10" r="5" fill="#ffffff" stroke="#f59e0b" stroke-width="2.5"/>
                        </svg>
                    </div>

                    <!-- FECHAS INFERIORES EN ESPAÑOL -->
                    <div style="display: flex; justify-content: space-between; font-size: 11px; color: #6b7280; font-weight: bold; margin-top: 8px;">
                        <span>10 Abr</span>
                        <span>13 Jun</span>
                        <span>16 Jun</span>
                        <span>20 Ago</span>
                    </div>

                </div>
            </div>

        </div>
    `;
}
// --- PESTAÑA 3: HISTORIAL (GRÁFICA Y TEXTOS EN ESPAÑOL) ---
function renderClubHistoryTab() {
    const data = currentClubData;
    const resDiv = document.getElementById('resultado-club');
    if (!data || !resDiv) return;

    const currentTrophies = data.trophies ? data.trophies : 0;
    const numMiembros = data.members ? data.members.length : 0;
    
    const lowestTrophies = Math.round(currentTrophies * 0.7);
    const peakTrophies = currentTrophies;

    resDiv.innerHTML = `
        <div style="max-width: 950px; margin: 0 auto; display: flex; flex-direction: column; gap: 15px; text-align: left; font-family: 'Inter', sans-serif; color: #ffffff;">
            
            <div style="background: #18181c; border: 1px solid #2a2a30; border-radius: 12px; padding: 20px 24px; display: flex; justify-content: space-between; align-items: center;">
                <h2 style="color: #ffffff; font-family: 'Lilita One', cursive, sans-serif; font-size: 26px; margin: 0;">${data.name}</h2>
                <span style="color: #f59e0b; font-weight: 800; font-size: 16px;">🏆 ${currentTrophies.toLocaleString()}</span>
            </div>

            <div style="display: flex; gap: 10px;">
                <button onclick="renderClubProfileTab()" style="background: #18181c; color: #9ca3af; padding: 6px 18px; border-radius: 6px; font-weight: bold; font-size: 13px; cursor: pointer; border: 1px solid #2a2a30;">Perfil</button>
                <button onclick="renderClubMembersTab()" style="background: #18181c; color: #9ca3af; padding: 6px 18px; border-radius: 6px; font-weight: bold; font-size: 13px; cursor: pointer; border: 1px solid #2a2a30;">Miembros (${numMiembros})</button>
                <button onclick="renderClubHistoryTab()" style="background: #a3e635; color: #000000; padding: 6px 18px; border-radius: 6px; font-weight: bold; font-size: 13px; cursor: pointer; border: none;">Historial</button>
            </div>

            <div style="background: #18181c; border: 1px solid #2a2a30; border-radius: 12px; padding: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                    <div>
                        <div style="font-size: 32px; font-weight: 800; color: #a3e635; font-family: 'Lilita One', cursive, sans-serif; display: inline-block;">132</div>
                        <span style="color: #ffffff; font-weight: 800; font-size: 13px; margin-left: 5px;">DÍAS RASTREADOS</span>
                        <div style="color: #6b7280; font-size: 12px; font-weight: 600; margin-top: 2px;">desde 10 Abr, 2026</div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 28px; font-weight: 800; color: #f59e0b; font-family: 'Lilita One', cursive, sans-serif;">${currentTrophies.toLocaleString()}</div>
                        <span style="color: #6b7280; font-size: 10px; font-weight: bold;">ACTUAL</span>
                    </div>
                </div>

                <div style="font-size: 11px; color: #9ca3af; font-weight: bold; margin-bottom: 8px;">EVENTOS TOTALES: 4 • PROMEDIO 0.2/SEM</div>
                
                <div style="background: #2a2a30; height: 6px; border-radius: 3px; overflow: hidden; margin-bottom: 6px;">
                    <div style="background: #a3e635; width: 36%; height: 100%;"></div>
                </div>
                <span style="color: #6b7280; font-size: 10px; font-weight: bold;">36% DE 1 AÑO</span>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 12px;">
                <div style="background: #18181c; border: 1px solid #2a2a30; border-radius: 8px; padding: 15px;">
                    <span style="color: #6b7280; font-size: 10px; font-weight: bold; display: block; margin-bottom: 8px;">ÚLTIMOS 7 DÍAS</span>
                    <div style="display: flex; gap: 10px; font-weight: 800; font-size: 16px;">
                        <span style="color: #34d399;">+4</span>
                        <span style="color: #f87171;">-4</span>
                    </div>
                    <span style="color: #6b7280; font-size: 10px; margin-top: 4px; display: block;">1 EVENTOS</span>
                </div>

                <div style="background: #18181c; border: 1px solid #2a2a30; border-radius: 8px; padding: 15px;">
                    <span style="color: #6b7280; font-size: 10px; font-weight: bold; display: block; margin-bottom: 8px;">ÚLTIMOS 30 DÍAS</span>
                    <div style="display: flex; gap: 10px; font-weight: 800; font-size: 16px;">
                        <span style="color: #34d399;">+4</span>
                        <span style="color: #f87171;">-4</span>
                    </div>
                    <span style="color: #6b7280; font-size: 10px; margin-top: 4px; display: block;">1 EVENTOS</span>
                </div>

                <div style="background: #18181c; border: 1px solid #2a2a30; border-radius: 8px; padding: 15px;">
                    <span style="color: #6b7280; font-size: 10px; font-weight: bold; display: block; margin-bottom: 8px;">TODO EL TIEMPO</span>
                    <div style="display: flex; gap: 10px; font-weight: 800; font-size: 16px;">
                        <span style="color: #34d399;">+22</span>
                        <span style="color: #f87171;">-22</span>
                    </div>
                    <span style="color: #6b7280; font-size: 10px; margin-top: 4px; display: block;">0 ROLES</span>
                </div>
            </div>

            <div style="background: #18181c; border: 1px solid #2a2a30; border-radius: 12px; padding: 20px;">
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; text-align: center; margin-bottom: 15px;">
                    <div>
                        <div style="color: #f87171; font-size: 22px; font-weight: 800; font-family: 'Lilita One', cursive, sans-serif;">${lowestTrophies.toLocaleString()}</div>
                        <span style="color: #6b7280; font-size: 10px; font-weight: bold;">MÍNIMO</span>
                    </div>
                    <div>
                        <div style="color: #f59e0b; font-size: 22px; font-weight: 800; font-family: 'Lilita One', cursive, sans-serif;">${currentTrophies.toLocaleString()}</div>
                        <span style="color: #6b7280; font-size: 10px; font-weight: bold;">ACTUAL</span>
                    </div>
                    <div>
                        <div style="color: #f59e0b; font-size: 22px; font-weight: 800; font-family: 'Lilita One', cursive, sans-serif;">${peakTrophies.toLocaleString()}</div>
                        <span style="color: #6b7280; font-size: 10px; font-weight: bold;">MÁXIMO</span>
                    </div>
                </div>

                <div style="background: #2a2a30; height: 8px; border-radius: 4px; overflow: hidden; position: relative; margin-bottom: 10px;">
                    <div style="background: linear-gradient(90deg, #f87171 0%, #f59e0b 50%, #a3e635 100%); width: 100%; height: 100%;"></div>
                    <div style="position: absolute; right: 2px; top: 1px; width: 6px; height: 6px; background: #ffffff; border-radius: 50%;"></div>
                </div>
                <div style="text-align: center; color: #6b7280; font-size: 11px; font-weight: 800; letter-spacing: 0.5px;">MÁXIMO HISTÓRICO ALCANZADO</div>
            </div>

            <!-- GRÁFICA DE PROGRESIÓN (CORREGIDA CON PUNTOS ALINEADOS AL MILÍMETRO Y MARGEN IZQUIERDO) -->
            <div style="background: #18181c; border: 1px solid #2a2a30; border-radius: 12px; padding: 20px;">
                <span style="color: #a3e635; font-size: 12px; font-weight: 800; letter-spacing: 1px; display: block; margin-bottom: 20px;">PROGRESIÓN DE TROFEOS</span>

                <div style="position: relative; width: 100%; padding-left: 65px; box-sizing: border-box;">
                    
                    <!-- VALORES EJE Y (MARGEN IZQUIERDO) -->
                    <div style="position: absolute; left: 0; top: 0; bottom: 25px; width: 60px; display: flex; flex-direction: column; justify-content: space-between; text-align: right; font-size: 9px; color: #6b7280; font-weight: 600;">
                        <div>${currentTrophies.toLocaleString()}</div>
                        <div>${Math.round(currentTrophies*0.9).toLocaleString()}</div>
                        <div>${Math.round(currentTrophies*0.8).toLocaleString()}</div>
                        <div>${lowestTrophies.toLocaleString()}</div>
                    </div>

                    <!-- ÁREA DE DIBUJO SVG Y LÍNEAS -->
                    <div style="position: relative; height: 180px; border-left: 1px solid #2a2a30; border-bottom: 1px solid #2a2a30;">
                        
                        <!-- LÍNEAS GUÍA DE FONDO -->
                        <div style="position: absolute; width: 100%; top: 0%; border-bottom: 1px dashed #2a2a30;"></div>
                        <div style="position: absolute; width: 100%; top: 33%; border-bottom: 1px dashed #2a2a30;"></div>
                        <div style="position: absolute; width: 100%; top: 66%; border-bottom: 1px dashed #2a2a30;"></div>
                        <div style="position: absolute; width: 100%; top: 100%; border-bottom: 1px dashed #2a2a30;"></div>

                        <svg viewBox="0 0 500 150" preserveAspectRatio="none" style="width: 100%; height: 100%; display: block;">
                            <defs>
                                <linearGradient id="yellowGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.35"/>
                                    <stop offset="100%" stop-color="#f59e0b" stop-opacity="0.0"/>
                                </linearGradient>
                            </defs>
                            
                            <!-- ÁREA BAJO LA CURVA -->
                            <path d="M 10 130 Q 170 45, 330 38 T 490 10 L 490 150 L 10 150 Z" fill="url(#yellowGrad)"/>
                            
                            <!-- LÍNEAS DE TENDENCIA Y PUNTOS EXACTOS EN SUS COORDENADAS -->
                            <path d="M 10 130 Q 170 45, 330 38 T 490 10" fill="none" stroke="#f59e0b" stroke-width="3.5" stroke-linecap="round"/>
                            
                            <circle cx="10" cy="130" r="5" fill="#ffffff" stroke="#f59e0b" stroke-width="2.5"/>
                            <circle cx="170" cy="52" r="5" fill="#ffffff" stroke="#f59e0b" stroke-width="2.5"/>
                            <circle cx="330" cy="38" r="5" fill="#ffffff" stroke="#f59e0b" stroke-width="2.5"/>
                            <circle cx="490" cy="10" r="5" fill="#ffffff" stroke="#f59e0b" stroke-width="2.5"/>
                        </svg>
                    </div>

                    <!-- FECHAS INFERIORES EN ESPAÑOL -->
                    <div style="display: flex; justify-content: space-between; font-size: 11px; color: #6b7280; font-weight: bold; margin-top: 8px;">
                        <span>10 Abr</span>
                        <span>13 Jun</span>
                        <span>16 Jun</span>
                        <span>20 Ago</span>
                    </div>

                </div>
            </div>

        </div>
    `;
}

async function compararJugadores() {
    // 1. Obtener valores usando los IDs EXACTOS de tu HTML
    let tag1 = document.getElementById('tag-comp-1').value.trim().toUpperCase();
    let tag2 = document.getElementById('tag-comp-2').value.trim().toUpperCase();

    if (!tag1 || !tag2) {
        return alert("Por favor introduce los TAGs de ambos jugadores");
    }

    if (!tag1.startsWith('#')) tag1 = '#' + tag1;
    if (!tag2.startsWith('#')) tag2 = '#' + tag2;

    const resDiv = document.getElementById('resultado-comparacion');
    resDiv.innerHTML = `<p style="color:white; text-align:center; padding: 20px;">⚔️ Comparando perfiles...</p>`;

    try {
        const [res1, res2] = await Promise.all([
            fetch(`/api/player/${encodeURIComponent(tag1)}`),
            fetch(`/api/player/${encodeURIComponent(tag2)}`)
        ]);

        const p1 = await res1.json();
        const p2 = await res2.json();

        if (p1.error || p2.error) {
            resDiv.innerHTML = `<p style="color:#ef4444; text-align:center;">❌ Uno o ambos jugadores no se han encontrado</p>`;
            return;
        }

        const getClubBadge = (data) => {
            if (!data.club || !data.club.name) return 'https://cdn.brawlify.com/club-badges/regular/8000000.png';
            let badgeId = data.club.badgeId ?? data.club.badge?.id ?? data.club.badge;
            return badgeId ? `https://cdn.brawlify.com/club-badges/regular/${badgeId}.png` : 'https://cdn.brawlify.com/club-badges/regular/8000000.png';
        };

        const getCompareHTML = (val1, val2, isFormatted = true) => {
            const v1 = Number(val1) || 0;
            const v2 = Number(val2) || 0;
            const str1 = isFormatted ? v1.toLocaleString() : v1;
            const str2 = isFormatted ? v2.toLocaleString() : v2;

            if (v1 > v2) {
                return {
                    left: `<span style="color:#4ade80; font-weight:800;">${str1} 🔺</span>`,
                    right: `<span style="color:#f87171; font-weight:700;">${str2} 🔻</span>`
                };
            } else if (v2 > v1) {
                return {
                    left: `<span style="color:#f87171; font-weight:700;">${str1} 🔻</span>`,
                    right: `<span style="color:#4ade80; font-weight:800;">${str2} 🔺</span>`
                };
            } else {
                return {
                    left: `<span style="color:#ffffff; font-weight:700;">${str1} ➖</span>`,
                    right: `<span style="color:#ffffff; font-weight:700;">${str2} ➖</span>`
                };
            }
        };

        const copas = getCompareHTML(p1.trophies, p2.trophies);
        const maxCopas = getCompareHTML(p1.highestTrophies, p2.highestTrophies);
        const brawlers = getCompareHTML(p1.brawlers?.length, p2.brawlers?.length, false);
        const v3v3 = getCompareHTML(p1['3vs3Victories'], p2['3vs3Victories']);
        const vSolo = getCompareHTML(p1.soloVictories, p2.soloVictories);
        const vDuo = getCompareHTML(p1.duoVictories, p2.duoVictories);

        const getAvgPower = (p) => {
            if (!p.brawlers || !p.brawlers.length) return 0;
            const sum = p.brawlers.reduce((acc, b) => acc + (b.power || 1), 0);
            return (sum / p.brawlers.length).toFixed(1);
        };
        const avgPower1 = getAvgPower(p1);
        const avgPower2 = getAvgPower(p2);
        const powerCompare = getCompareHTML(avgPower1, avgPower2, false);

        const renderRow = (label, compObj) => `
            <div style="display: grid; grid-template-columns: 1fr 1.2fr 1fr; padding: 12px; border-bottom: 1px solid #3d166d; text-align: center; font-size: 14px;">
                <div>${compObj.left}</div>
                <div style="color: #a78bfa; font-weight: 800; font-size: 12px; text-transform: uppercase;">${label}</div>
                <div>${compObj.right}</div>
            </div>
        `;

        resDiv.innerHTML = `
            <div style="max-width: 900px; margin: 0 auto; display: flex; flex-direction: column; gap: 15px;">
                
                <div style="display: grid; grid-template-columns: 1fr auto 1fr; gap: 10px; align-items: center; background: #1e0c38; border: 1px solid #3d166d; border-radius: 12px; padding: 20px;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <img src="https://cdn.brawlify.com/profile-icons/regular/${p1.icon?.id || 28000000}.png" style="width: 50px; height: 50px; border-radius: 8px; border: 2px solid #8b5cf6;">
                        <div style="overflow: hidden;">
                            <h3 style="color: #fff; margin: 0; font-family: 'Lilita One', cursive, sans-serif; font-size: 18px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${p1.name}</h3>
                            <span style="color: #a78bfa; font-size: 12px;">${p1.tag}</span>
                        </div>
                    </div>

                    <div style="background: #f59e0b; color: #000; font-weight: 900; font-family: 'Lilita One', cursive, sans-serif; padding: 6px 14px; border-radius: 8px; font-size: 18px;">VS</div>

                    <div style="display: flex; align-items: center; justify-content: flex-end; gap: 12px; text-align: right;">
                        <div style="overflow: hidden;">
                            <h3 style="color: #fff; margin: 0; font-family: 'Lilita One', cursive, sans-serif; font-size: 18px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${p2.name}</h3>
                            <span style="color: #a78bfa; font-size: 12px;">${p2.tag}</span>
                        </div>
                        <img src="https://cdn.brawlify.com/profile-icons/regular/${p2.icon?.id || 28000000}.png" style="width: 50px; height: 50px; border-radius: 8px; border: 2px solid #8b5cf6;">
                    </div>
                </div>

                <div style="background: #1e0c38; border: 1px solid #3d166d; border-radius: 12px; overflow: hidden;">
                    ${renderRow('🏆 Copas Actuales', copas)}
                    ${renderRow('⭐ Máximas Copas', maxCopas)}
                    ${renderRow('👾 Brawlers Desbloqueados', brawlers)}
                    ${renderRow('🥇 Victorias 3v3', v3v3)}
                    ${renderRow('💀 Victorias Solo', vSolo)}
                    ${renderRow('👥 Victorias Duo', vDuo)}
                    ${renderRow('⚡ Fuerza Promedio', powerCompare)}

                    <div style="display: grid; grid-template-columns: 1fr 1.2fr 1fr; padding: 15px 12px; text-align: center; background: #110626; align-items: center;">
                        <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                            <img src="${getClubBadge(p1)}" style="width: 28px; height: 28px; object-fit: contain;">
                            <span style="color: #fff; font-weight: 700; font-size: 13px;">${p1.club?.name || 'Sin Club'}</span>
                        </div>
                        <div style="color: #a78bfa; font-weight: 800; font-size: 12px; text-transform: uppercase;">Club</div>
                        <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                            <img src="${getClubBadge(p2)}" style="width: 28px; height: 28px; object-fit: contain;">
                            <span style="color: #fff; font-weight: 700; font-size: 13px;">${p2.club?.name || 'Sin Club'}</span>
                        </div>
                    </div>
                </div>

            </div>
        `;

    } catch (err) {
        resDiv.innerHTML = `<p style="color:#ef4444; text-align:center;">❌ Error en la conexión al servidor</p>`;
    }
}

let timerInterval = null;

// Cargar al iniciar la página
document.addEventListener("DOMContentLoaded", () => {
    cargarRotacionMapas();
});

window.cargarRotacionMapas = cargarRotacionMapas;
// --- SISTEMA DE SESIÓN Y USUARIO ---
const defaultUserData = {
    isLoggedIn: false,
    username: "Invitado",
    coins: 0
};

function saveUserData(userData) {
    localStorage.setItem('birrias_user_session', JSON.stringify(userData));
}

function renderUserProfile(user) {
    const btnLogin = document.getElementById('btn-login');
    const userInfo = document.getElementById('user-info');
    const nameEl = document.getElementById('user-name-text');
    const avatarInitial = document.getElementById('user-avatar-initial');

    // Control de visualización del perfil/botón de login
    if (user && user.isLoggedIn) {
        if (btnLogin) btnLogin.style.display = 'none';
        if (userInfo) {
            userInfo.style.display = 'flex';
            userInfo.style.alignItems = 'center';
            userInfo.style.gap = '10px';
        }
        if (nameEl) nameEl.textContent = user.username;
        if (avatarInitial) avatarInitial.textContent = user.username.charAt(0).toUpperCase();
    } else {
        if (btnLogin) btnLogin.style.display = 'block';
        if (userInfo) userInfo.style.display = 'none';
    }
} // <-- AQUÍ FALTABA ESTA LLAVE DE CIERRE

let intervalosCuentaAtras = [];
var mapaTimerInterval = null;
function cargarRotacionMapas() {
    var contenedor = document.getElementById('contenedor-eventos');
    if (!contenedor) return;

    if (typeof mapaTimerInterval !== 'undefined' && mapaTimerInterval) {
        clearInterval(mapaTimerInterval);
    }

    contenedor.innerHTML = '<p style="color: white; text-align: center; grid-column: 1/-1;">Cargando rotación de mapas...</p>';

    fetch('/api/mapas')
        .then(async function(res) {
            var data = await res.json().catch(function() { return {}; });
            if (!res.ok) {
                throw new Error(data.error || 'Error HTTP: ' + res.status);
            }
            if (!Array.isArray(data)) {
                throw new Error(data.error || 'La respuesta de mapas no tiene el formato esperado.');
            }
            return data;
        })
        .then(function(eventos) {
            if (eventos.length === 0) {
                contenedor.innerHTML = '<p style="color: white; text-align: center; grid-column: 1/-1;">No hay eventos disponibles en este momento.</p>';
                return;
            }

            contenedor.style.display = 'grid';
            contenedor.innerHTML = '';

            eventos.forEach(function(item, index) {
                var live = item.live || {};
                var modoNombre = item.modo_nombre || 'BRAWL STARS';
                var liveName = live.name || 'En Vivo';
                var liveImgUrl = live.img || '';
                var endMs = item.endTimestamp || '';

                var liveImg = liveImgUrl
                    ? '<img src="' + liveImgUrl + '" alt="Mapa ' + liveName + '">'
                    : '<span class="map-card-no-image">Imagen del mapa no disponible</span>';

                var htmlTarjeta = 
                    '<article class="map-card">' +
                        '<div class="map-card-header">' +
                            '<span class="map-card-mode">' + modoNombre + '</span>' +
                            '<div class="map-card-clock">' +
                                '<span class="map-card-timer-label">SIGUIENTE ROTACIÓN</span>' +
                                '<span class="map-countdown" id="timer-' + index + '" data-timestamp="' + endMs + '">--H --M --S</span>' +
                            '</div>' +
                        '</div>' +
                        '<div class="map-card-body">' +
                            '<div class="map-card-art">' + liveImg + '</div>' +
                            '<p class="map-card-name">' + liveName + '</p>' +
                        '</div>' +
                    '</article>';

                contenedor.innerHTML += htmlTarjeta;
            });

            if (typeof iniciarContadores === 'function') {
                iniciarContadores();
            }
        })
        .catch(function(err) {
            console.error('Error al cargar mapas:', err);
            contenedor.innerHTML = '<p style="color: #fca5a5; text-align: center; grid-column: 1/-1;">❌ ' + err.message + '</p>';
        });
}

function iniciarContadores() {
    if (timerInterval) {
        clearInterval(timerInterval);
    }

    timerInterval = setInterval(function() {
        var timers = document.querySelectorAll('[id^="timer-"]');
        timers.forEach(function(elem) {
            var targetMs = parseInt(elem.getAttribute('data-timestamp'));
            if (!targetMs) {
                elem.innerText = "--H --M --S";
                return;
            }

            var diff = targetMs - Date.now();

            if (diff <= 0) {
                elem.innerText = "¡RENOVANDO!";
                return;
            }

            var hrs = Math.floor(diff / (1000 * 60 * 60)).toString().padStart(2, '0');
            var mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)).toString().padStart(2, '0');
            var secs = Math.floor((diff % (1000 * 60)) / 1000).toString().padStart(2, '0');

            elem.innerText = hrs + 'H ' + mins + 'M ' + secs + 'S';
        });
    }, 1000);
}

function actualizarBirriacoins(user) {
    var btnLogin = document.getElementById('btn-login');
    var userInfo = document.getElementById('user-info');
    var coinsContainer = document.getElementById('birriacoins-container');
    
    if (!coinsContainer) {
        coinsContainer = document.createElement('div');
        coinsContainer.id = 'birriacoins-container';
        coinsContainer.style.cssText = 'display:inline-flex; align-items:center; gap:8px; background:#1e0c38; border:1px solid #f59e0b; padding:4px 12px; border-radius:20px; font-weight:bold; color:#f59e0b; margin-right:10px;';
        
        var parent = (btnLogin && btnLogin.parentElement) || (userInfo && userInfo.parentElement);
        if (parent) {
            parent.insertBefore(coinsContainer, btnLogin || userInfo);
        }
    }

    var coinsVal = Number((user && user.coins) || 0).toLocaleString();
    var birriacoinImg = "/static/images/birriacoin.png";

    coinsContainer.innerHTML = '<img src="' + birriacoinImg + '" style="width:22px; height:22px; object-fit:cover; border-radius:50%;" alt="Birriacoin">' +
                                '<span id="user-birriacoins">' + coinsVal + '</span>';
}

window.cargarRotacionMapas = cargarRotacionMapas;
window.actualizarBirriacoins = actualizarBirriacoins;

// ==========================================
// 1. SISTEMA DE LA RULETA (Franjas: 08:00, 15:00, 22:00)
// ==========================================
const premiosRuleta = [
    { valor: "10 Birriacoins", probabilidad: "36.40%", color: "#ff2a2a" },
    { valor: "25 Birriacoins", probabilidad: "31.20%", color: "#00e676" },
    { valor: "50 Birriacoins", probabilidad: "20.80%", color: "#29b6f6" },
    { valor: "100 Birriacoins", probabilidad: "10.40%", color: "#ffd600" },
    { valor: "500 Birriacoins", probabilidad: "1.20%", color: "#ff06c9" }
];

const birriaIconRuleta = new Image();
birriaIconRuleta.src = '/static/images/birriacoin.png';
let intentosMaximosRuleta = 3;

function obtenerEstadoRuletaMinijuego() {
    let datos = JSON.parse(localStorage.getItem('birrias_ruleta_estado'));
    const ahora = new Date();
    const horaActual = ahora.getHours();
    const minutoActual = ahora.getMinutes();
    const segundoActual = ahora.getSeconds();
    const segundoActualTotal = horaActual * 3600 + minutoActual * 60 + segundoActual;

    // Franjas horarias fijas: 08:00, 15:00 y 22:00
    const franjasSegundos = [8 * 3600, 15 * 3600, 22 * 3600];

    let proximaFranjaSegundos = franjasSegundos.find(f => f > segundoActualTotal);
    if (proximaFranjaSegundos === undefined) {
        proximaFranjaSegundos = franjasSegundos[0] + 86400;
    }

    let segundosRestantes = proximaFranjaSegundos - segundoActualTotal;
    if (segundosRestantes < 0) segundosRestantes = 0;

    const idFranjaActual = `${ahora.toDateString()}-${horaActual >= 22 ? '22' : horaActual >= 15 ? '15' : horaActual >= 8 ? '08' : 'madrugada'}`;

    if (!datos) {
        datos = { intentos: intentosMaximosRuleta, ultimaFranjaRegistrada: idFranjaActual };
        localStorage.setItem('birrias_ruleta_estado', JSON.stringify(datos));
    }

    if (datos.ultimaFranjaRegistrada !== idFranjaActual) {
        datos.intentos = intentosMaximosRuleta;
        datos.ultimaFranjaRegistrada = idFranjaActual;
        localStorage.setItem('birrias_ruleta_estado', JSON.stringify(datos));
    }

    return {
        intentos: Number(datos.intentos) || 0,
        segundosRestantes: Number(segundosRestantes) || 0
    };
}

function actualizarTimerVisualRuleta() {
    const estado = obtenerEstadoRuletaMinijuego();
    const timerContainer = document.getElementById('contenedor-timer-ruleta');
    const horasEl = document.getElementById('timer-horas-ruleta');
    const minEl = document.getElementById('timer-min-ruleta');
    const segEl = document.getElementById('timer-seg-ruleta');
    const badgeDisponible = document.getElementById('badge-disponible-ruleta');

    let horas = Math.floor(estado.segundosRestantes / 3600);
    let minutos = Math.floor((estado.segundosRestantes % 3600) / 60);
    let segundos = estado.segundosRestantes % 60;

    if (horasEl) horasEl.textContent = String(horas).padStart(2, '0');
    if (minEl) minEl.textContent = String(minutos).padStart(2, '0');
    if (segEl) segEl.textContent = String(segundos).padStart(2, '0');
    
    if (estado.intentos <= 0) {
        if (timerContainer) timerContainer.style.display = "block";
        if (badgeDisponible) badgeDisponible.style.display = 'none';
    } else {
        if (timerContainer) timerContainer.style.display = "none";
        if (badgeDisponible) badgeDisponible.style.display = 'flex';
    }
}

const porcionesRuletaMinijuego = [
    "10", "25", "50", "100", "500", 
    "10", "25", "50", "100", "500"
];
const numPorcionesRuleta = porcionesRuletaMinijuego.length;
const anguloPorcionRuleta = (2 * Math.PI) / numPorcionesRuleta;

const coloresPorcionesRuleta = [
    '#ff2a2a', '#00e676', '#29b6f6', '#ffd600', '#9c27b0', 
    '#ff2a2a', '#00e676', '#29b6f6', '#ffd600', '#9c27b0'
];
function dibujarCanvasRuletaEspecifico(canvasId, tamanoCanvas) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    if (!tamanoCanvas) {
        if (canvasId === 'roulette-canvas-fullscreen') {
            const minDim = Math.min(window.innerWidth, window.innerHeight);
            tamanoCanvas = minDim * 0.88;
        } else {
            tamanoCanvas = 425;
        }
    }

    const scaleFactor = 3; 
    canvas.width = tamanoCanvas * scaleFactor;
    canvas.height = tamanoCanvas * scaleFactor;
    canvas.style.width = tamanoCanvas + 'px';
    canvas.style.height = tamanoCanvas + 'px';
    canvas.style.aspectRatio = '1 / 1';
    canvas.style.maxWidth = 'none';
    canvas.style.maxHeight = 'none';

    ctx.scale(scaleFactor, scaleFactor);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const centro = tamanoCanvas / 2;
    const radio = Math.max(0, centro - 15);
    let anguloInicio = 0;

    ctx.clearRect(0, 0, tamanoCanvas, tamanoCanvas);

    porcionesRuletaMinijuego.forEach((valor, index) => {
        const anguloFin = anguloInicio + anguloPorcionRuleta;
        const colorSector = coloresPorcionesRuleta[index % coloresPorcionesRuleta.length];

        ctx.beginPath();
        ctx.moveTo(centro, centro);
        ctx.arc(centro, centro, radio, anguloInicio, anguloFin);
        ctx.fillStyle = colorSector;
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.save();
        ctx.translate(centro, centro);
        ctx.rotate(anguloInicio + anguloPorcionRuleta / 2);
        
        ctx.fillStyle = "#ffffff";
        const fontSize = Math.max(16, Math.round(tamanoCanvas * 0.04));
        ctx.font = `bold ${fontSize}px 'Lilita One', sans-serif`;
        ctx.textAlign = "right";
        ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
        ctx.shadowBlur = 4;

        const distanciaTexto = radio - (tamanoCanvas * 0.1);
        ctx.fillText(valor, distanciaTexto, fontSize * 0.3);
        
        if (birriaIconRuleta.complete && birriaIconRuleta.naturalWidth !== 0) {
            const coinSize = Math.round(fontSize * 1.6);
            ctx.drawImage(birriaIconRuleta, distanciaTexto + 8, -coinSize / 2, coinSize, coinSize);
        }
        
        ctx.restore();
        anguloInicio = anguloFin;
    });

    ctx.beginPath();
    ctx.arc(centro, centro, Math.max(18, tamanoCanvas * 0.045), 0, 2 * Math.PI);
    ctx.fillStyle = "#3b1c58";
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#ffd700";
    ctx.stroke();
}

function inicializarCanvasesRuleta() {
    dibujarCanvasRuletaEspecifico('roulette-canvas', 425);
    dibujarCanvasRuletaEspecifico('roulette-canvas-fullscreen');
}

window.addEventListener('resize', () => {
    const modalFull = document.getElementById('modal-pantalla-completa-ruleta');
    if (modalFull && modalFull.style.display === 'flex') {
        dibujarCanvasRuletaEspecifico('roulette-canvas-fullscreen');
    }
});

let anguloTotalRuleta = 0;

// ==========================================
// 1. SISTEMA DE LA RULETA (Con descuento y Firebase)
// ==========================================
window.girarRuletaConControl = async function() {
    let rawDatos = JSON.parse(localStorage.getItem('birrias_ruleta_estado'));
    if (!rawDatos || rawDatos.intentos <= 0) return;

    const btn = document.getElementById('btn-spin-wheel');
    const modal = document.getElementById('modal-pantalla-completa-ruleta');
    const esFullscreen = modal && modal.style.display === 'flex';
    const canvas = document.getElementById(esFullscreen ? 'roulette-canvas-fullscreen' : 'roulette-canvas');
    
    if (!canvas) return;
    if (btn) btn.disabled = true;

    rawDatos.intentos--;
    localStorage.setItem('birrias_ruleta_estado', JSON.stringify(rawDatos));

    const indexAleatorio = Math.floor(Math.random() * porcionesRuletaMinijuego.length);
    const premioReal = parseInt(porcionesRuletaMinijuego[indexAleatorio]);

    const gradosPorcion = 36; 
    const centroDelQuesito = (indexAleatorio * gradosPorcion) + (gradosPorcion / 2);
    const offsetGrados = 270; 
    const gradosObjetivo = (360 - (centroDelQuesito - offsetGrados)) % 360;

    anguloTotalRuleta += 1800 + ((gradosObjetivo - (anguloTotalRuleta % 360) + 360) % 360);

    canvas.style.transition = "transform 4s cubic-bezier(0.15, 0.85, 0.15, 1)";
    canvas.style.transform = `rotate(${anguloTotalRuleta}deg)`;

    setTimeout(async () => {
        // Sumar el premio ganado y guardarlo automáticamente en Firebase
        if (typeof window.modificarMonedas === 'function') {
            await window.modificarMonedas(premioReal, true);
        } else {
            const display = document.getElementById('user-birriacoins') || document.getElementById('coins-amount');
            if (display) {
                let saldoActual = parseInt(display.textContent.replace(/,/g, '')) || 0;
                let saldoFinal = saldoActual + premioReal;
                display.textContent = saldoFinal.toLocaleString();
            }
        }
        
        mostrarPremioRuleta(premioReal);
        verificarEstadoBotonRuleta();
        if (typeof actualizarTimerVisualRuleta === 'function') actualizarTimerVisualRuleta();
    }, 4100);
};
// Diccionario exacto basado en los nombres de tus archivos PNG
const mapaBordersArchivos = {
    "España": "es.png",
    "México": "mx.png",
    "Argentina": "ar.png",
    "Colombia": "co.png",
    "Chile": "cl.png",
    "Perú": "pe.png",
    "Venezuela": "ve.png",
    "Estados Unidos": "us.png",
    "Brasil": "br.png",
    "Alemania": "de.png",
    "Andorra": "ad.png",
    "Canadá": "ca.png",
    "Francia": "fr.png",
    "Italia": "it.png",
    "Reino Unido": "gb.png",
    "Japón": "jp.png",
    "Otro": "other.png"
};

// Función para seleccionar automáticamente el valor guardado en Firestore o LocalStorage
function seleccionarNacionalidadGuardada(paisGuardado) {
    const selectReg = document.getElementById('reg-nacionalidad') || document.getElementById('input-perfil-nacionalidad');
    if (selectReg && paisGuardado) {
        selectReg.value = paisGuardado;
    }
}
function verificarEstadoBotonRuleta() {
    const estado = obtenerEstadoRuletaMinijuego();
    const btn = document.getElementById('btn-spin-wheel');
    const timerContainer = document.getElementById('contenedor-timer-ruleta');
    const badgeDisponible = document.getElementById('badge-disponible-ruleta');

    if (!btn) return;

    if (estado.intentos <= 0) {
        btn.textContent = "🔒 ¡AGOTADO!";
        btn.style.background = "#4a5568";
        btn.style.opacity = "0.7";
        btn.style.cursor = "not-allowed";
        btn.disabled = true;
        if (timerContainer) timerContainer.style.display = "block";
        if (badgeDisponible) badgeDisponible.style.display = 'none';
    } else {
        btn.innerHTML = "⚡ ¡GIRAR RULETA AHORA! ⚡";
        btn.style.background = "linear-gradient(135deg, #ff416c, #ff4b2b)";
        btn.style.opacity = "1";
        btn.style.cursor = "pointer";
        btn.disabled = false;
        if (timerContainer) timerContainer.style.display = "none";
        if (badgeDisponible) badgeDisponible.style.display = 'flex';
    }
}

window.abrirRuletaPantallaCompleta = function() {
    const modal = document.getElementById("modal-pantalla-completa-ruleta");
    if(modal) {
        modal.style.display = "flex";
        const contTimer = document.getElementById('contenedor-timer-ruleta');
        if(contTimer) contTimer.style.display = 'block';
        setTimeout(() => {
            dibujarCanvasRuletaEspecifico('roulette-canvas-fullscreen', 380);
            verificarEstadoBotonRuleta();
            actualizarTimerVisualRuleta();
        }, 20);
    }
}

window.cerrarRuletaPantallaCompleta = function() {
    const modal = document.getElementById("modal-pantalla-completa-ruleta");
    if(modal) {
        modal.style.display = "none";
        const contTimer = document.getElementById('contenedor-timer-ruleta');
        if(contTimer) contTimer.style.display = 'none';
    }
}

window.mostrarPremioRuleta = function(cantidadPremio) {
    const modalPremio = document.getElementById("modal-premio-ruleta");
    const textoPremio = document.getElementById("texto-premio-ganado");
    if (textoPremio) textoPremio.innerText = cantidadPremio + " BIRRIACOINS";
    if (modalPremio) modalPremio.style.display = "flex";
}

window.cerrarModalPremio = function() {
    const modalPremio = document.getElementById("modal-premio-ruleta");
    if (modalPremio) modalPremio.style.display = "none";
}


// ==========================================
// 2. SISTEMA DE LA MONEDA (Franjas: 08:00, 15:00, 22:00)
// ==========================================
function obtenerEstadoMonedaMinijuego() {
    let datos = JSON.parse(localStorage.getItem('birrias_moneda_estado'));
    const ahora = new Date();
    const horaActual = ahora.getHours();
    const minutoActual = ahora.getMinutes();
    const segundoActual = ahora.getSeconds();
    const segundoActualTotal = horaActual * 3600 + minutoActual * 60 + segundoActual;

    const franjasSegundos = [8 * 3600, 15 * 3600, 22 * 3600];

    let proximaFranjaSegundos = franjasSegundos.find(f => f > segundoActualTotal);
    if (proximaFranjaSegundos === undefined) {
        proximaFranjaSegundos = franjasSegundos[0] + 86400;
    }

    let segundosRestantes = proximaFranjaSegundos - segundoActualTotal;
    if (segundosRestantes < 0) segundosRestantes = 0;

    const idFranjaActual = `${ahora.toDateString()}-${horaActual >= 22 ? '22' : horaActual >= 15 ? '15' : horaActual >= 8 ? '08' : 'madrugada'}`;

    if (!datos) {
        datos = { intentos: 3, ultimaFranjaRegistrada: idFranjaActual };
        localStorage.setItem('birrias_moneda_estado', JSON.stringify(datos));
    }

    if (datos.ultimaFranjaRegistrada !== idFranjaActual) {
        datos.intentos = 3;
        datos.ultimaFranjaRegistrada = idFranjaActual;
        localStorage.setItem('birrias_moneda_estado', JSON.stringify(datos));
    }

    return {
        intentos: Number(datos.intentos) || 0,
        segundosRestantes: Number(segundosRestantes) || 0
    };
}

function actualizarInterfazMoneda() {
    const estado = obtenerEstadoMonedaMinijuego();
    
    // 1. Actualizar texto de tickets en la esquina superior
    const textoEsquina = document.getElementById('texto-tickets-esquina') || document.getElementById('badge-tickets-esquina');
    if (textoEsquina) {
        textoEsquina.innerText = `${estado.intentos} / 3`;
    }

    // 2. Actualizar contadores de tiempo
    let horas = Math.floor(estado.segundosRestantes / 3600);
    let minutos = Math.floor((estado.segundosRestantes % 3600) / 60);
    let segundos = estado.segundosRestantes % 60;

    const idsHoras = ['timer-horas-moneda-card', 'timer-horas-moneda-card-fs'];
    const idsMin = ['timer-min-moneda-card', 'timer-min-moneda-card-fs'];
    const idsSeg = ['timer-seg-moneda-card', 'timer-seg-moneda-card-fs'];

    idsHoras.forEach(id => { const el = document.getElementById(id); if (el) el.innerText = String(horas).padStart(2, '0'); });
    idsMin.forEach(id => { const el = document.getElementById(id); if (el) el.innerText = String(minutos).padStart(2, '0'); });
    idsSeg.forEach(id => { const el = document.getElementById(id); if (el) el.innerText = String(segundos).padStart(2, '0'); });

    // 3. Control absoluto del badge flotante "DISPONIBLE"
    let badgeDisponible = document.getElementById('badge-disponible-flotante'); // ✅ ID correcto
    const contenedorTimerCard = document.getElementById('contenedor-timer-moneda-card');
    
    const botonesGirar = document.querySelectorAll('button');
    let btnGirar = null;
    botonesGirar.forEach(b => {
        if (b.innerText.includes('GIRAR')) btnGirar = b;
    });

    const seccionDerecha = document.getElementById('seccion-juego-derecha');
    let btnAgotadoMoneda = document.getElementById('btn-agotado-moneda-dinamico');

    if (estado.intentos <= 0) {
        // --- SI NO HAY INTENTOS: Ocultar o eliminar el badge flotante ---
        if (badgeDisponible) {
            badgeDisponible.style.display = 'none';
        }

        if (btnGirar) {
            btnGirar.style.display = 'none';
        }
        if (contenedorTimerCard) {
            contenedorTimerCard.style.display = 'block';
        }

        if (!btnAgotadoMoneda && seccionDerecha) {
            btnAgotadoMoneda = document.createElement('button');
            btnAgotadoMoneda.id = 'btn-agotado-moneda-dinamico';
            btnAgotadoMoneda.disabled = true;
            btnAgotadoMoneda.innerHTML = "🔒 ¡AGOTADO!";
            btnAgotadoMoneda.style.cssText = "display: block; width: 240px; margin: 0 auto 15px auto; background: rgb(74, 85, 104); border: none; border-radius: 14px; padding: 14px; color: white; font-family: 'Lilita One', cursive; font-size: 18px; text-align: center; cursor: not-allowed; opacity: 0.8; box-shadow: 0 4px 15px rgba(0,0,0,0.3);";
            
            if (btnGirar && btnGirar.parentNode) {
                btnGirar.parentNode.insertBefore(btnAgotadoMoneda, btnGirar);
            } else {
                seccionDerecha.appendChild(btnAgotadoMoneda);
            }
        } else if (btnAgotadoMoneda) {
            btnAgotadoMoneda.style.display = 'block';
        }

    } else {
        // --- SI SÍ HAY INTENTOS: Mostrar el badge flotante ---
        if (badgeDisponible) {
            badgeDisponible.style.display = 'flex'; // o 'block' según prefieras
        }

        if (btnGirar) {
            btnGirar.style.display = 'block';
        }
        if (contenedorTimerCard) {
            contenedorTimerCard.style.display = 'none';
        }
        if (btnAgotadoMoneda) {
            btnAgotadoMoneda.style.display = 'none';
        }
    }
}
// ==========================================
// 3. INICIALIZADOR GLOBAL COMBINADO
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    obtenerEstadoRuletaMinijuego();
    inicializarCanvasesRuleta();
    verificarEstadoBotonRuleta();

    actualizarInterfazMoneda();

    setInterval(() => {
        actualizarTimerVisualRuleta();
        actualizarInterfazMoneda();
    }, 1000);
});

birriaIconRuleta.onload = function() {
    inicializarCanvasesRuleta();
};

// --- LÓGICA DE LA TIENDA CON SWEETALERT2 ---
const tarjetasTienda = document.querySelectorAll('.brawl-shop-card');

const configuracionTarjetas = [
    { precio: 750, nombre: 'un saludo personalizado', mensaje: '¡Solicitud enviada para tus próximos videos!' },
    { precio: 750, nombre: 'el VIP de Discord', mensaje: '¡Compra exitosa! Has adquirido el artículo correctamente.' },
    { precio: 1500, nombre: 'el Pase de Batalla', mensaje: '¡Canje realizado con éxito!' }
];

tarjetasTienda.forEach((tarjeta, index) => {
    const config = configuracionTarjetas[index];
    if (!config) return;

    const botonComprar = tarjeta.querySelector('button, .brawl-shop-footer, a, [class*="btn"], [class*="footer"]');
    
    if (botonComprar) {
        botonComprar.style.cursor = 'pointer';
        botonComprar.addEventListener('click', async () => {
            const display = document.getElementById('user-birriacoins') || document.getElementById('coins-amount');
            let saldoActual = display ? (parseInt(display.textContent.replace(/[^0-9]/g, '')) || 0) : (window.birriacoins || 0);

            if (saldoActual < config.precio) {
                if (typeof Swal !== 'undefined') {
                    Swal.fire({
                        icon: 'error',
                        title: 'Sin fondos',
                        text: `No tienes suficientes Birriacoins. Tienes ${saldoActual} y necesitas ${config.precio}.`,
                        background: '#18122c',
                        color: '#ffffff',
                        confirmButtonColor: '#7c3aed'
                    });
                } else {
                    alert(`¡No tienes suficientes Birriacoins! Tienes ${saldoActual} y necesitas ${config.precio}.`);
                }
                return;
            }

            if (typeof Swal !== 'undefined') {
                const resultado = await Swal.fire({
                    title: '¿Estás seguro?',
                    text: `¿Quieres canjear ${config.precio} Birriacoins por ${config.nombre}?`,
                    icon: 'question',
                    showCancelButton: true,
                    confirmButtonText: 'Sí, ¡canjear!',
                    cancelButtonText: 'Cancelar',
                    background: '#18122c',
                    color: '#ffffff',
                    confirmButtonColor: '#7c3aed',
                    cancelButtonColor: '#ef4444'
                });

                if (resultado.isConfirmed) {
                    await window.modificarMonedas(config.precio, false);
                    Swal.fire({
                        icon: 'success',
                        title: '¡Éxito!',
                        text: config.mensaje,
                        background: '#18122c',
                        color: '#ffffff',
                        confirmButtonColor: '#7c3aed'
                    });
                }
            }
        });
    }
});
// FUNCIONES GLOBALES PARA EL LANZAMIENTO DE MONEDA
// ==========================================

window.guardarMonedasEnFirebase = async function(nuevaCantidad) {
    const user = (typeof auth !== 'undefined' && auth.currentUser) ? auth.currentUser : null;
    if (!user) {
        console.warn("⚠️ No hay usuario autenticado.");
        return;
    }
    try {
        const userRef = doc(db, "usuarios", user.uid);
        await setDoc(userRef, { birriacoins: nuevaCantidad }, { merge: true });
        console.log("✅ Monedas sincronizadas con Firebase:", nuevaCantidad);
    } catch (error) {
        console.error("❌ Error al guardar en Firebase:", error);
    }
};

// ==========================================
// FUNCIÓN CENTRALIZADA DE PERSISTENCIA EN FIREBASE
// ==========================================
window.modificarMonedas = async function(cantidadCambio, esSuma = true) {
    // Usamos el auth genérico que ya tengas inicializado en tu proyecto
    const user = (typeof auth !== 'undefined' && auth.currentUser) ? auth.currentUser : null;
    const display = document.getElementById('user-birriacoins') || document.getElementById('coins-amount');
    
    let saldoActual = window.birriacoins || 0;
    if (display) {
        saldoActual = parseInt(display.textContent.replaceAll(',', '')) || saldoActual;
    }

    let nuevoSaldo = esSuma ? saldoActual + cantidadCambio : saldoActual - cantidadCambio;
    if (nuevoSaldo < 0) nuevoSaldo = 0;

    // 1. Actualizar variable global y elementos visuales inmediatamente
    window.birriacoins = nuevoSaldo;
    if (display) {
        display.textContent = nuevoSaldo.toLocaleString();
    }

    // 2. Actualizar también en el localStorage para que al cambiar de página no se pierda
    let usuarioLogueado = JSON.parse(localStorage.getItem('usuario_actual') || localStorage.getItem('user')) || {};
    usuarioLogueado.birriacoins = nuevoSaldo;
    localStorage.setItem('usuario_actual', JSON.stringify(usuarioLogueado));
    localStorage.setItem('user', JSON.stringify(usuarioLogueado));

    // 3. Guardar directamente en Firestore de forma segura
    if (user && typeof db !== 'undefined' && typeof doc !== 'undefined' && typeof updateDoc !== 'undefined') {
        try {
            const userRef = doc(db, "usuarios", user.uid);
            await updateDoc(userRef, { birriacoins: nuevoSaldo });
            console.log("✅ Saldo actualizado y guardado en Firebase:", nuevoSaldo);
        } catch (e) {
            console.error("❌ Error al guardar saldo en Firebase:", e);
        }
    }

    return nuevoSaldo;
};
let anguloMonedaTotal = 0;

const porcentajesFijosPremios = {
    500: "1.20%",
    100: "11.30%",
    50: "22.00%",
    25: "31.50%",
    10: "34.00%"
};

const pesos = [34.0, 31.5, 22.0, 11.3, 1.2];

// Función de animación corregida: acumula el ángulo anterior para que gire siempre limpio 1s constante y luego frene
function simularLanzamientoMoneda(coin, resultadoReal, onComplete) {
    // 1. Calculamos las vueltas de la fase constante (ej. 3 vueltas completas = 1080 deg)
    const gradosFaseConstante = 1080;
    anguloMonedaTotal += gradosFaseConstante;

    // Fase 1: Giro constante exacto de 1 segundo a velocidad lineal
    coin.style.transition = 'transform 1s linear';
    coin.style.transform = `rotateY(${anguloMonedaTotal}deg)`;

    // Fase 2: Al cumplirse exactamente 1 segundo, aplicamos el frenado hasta el resultado final
    setTimeout(() => {
        const vueltasExtraFrenado = 720; // 2 vueltas adicionales durante el frenado
        const extraDeg = (resultadoReal === 'cara') ? 0 : 180;
        
        // Alineamos el ángulo total acumulado con la posición final exacta de Cara o Cruz
        const restoActual = anguloMonedaTotal % 360;
        const objetivoParcial = (resultadoReal === 'cara') ? 0 : 180;
        let diferencia = objetivoParcial - restoActual;
        if (diferencia <= 0) diferencia += 360;

        anguloMonedaTotal += vueltasExtraFrenado + diferencia;

        // Duración del frenado: 1.2 segundos más con efecto ease-out suave
        coin.style.transition = 'transform 1.2s cubic-bezier(0.15, 0.85, 0.35, 1)';
        coin.style.transform = `rotateY(${anguloMonedaTotal}deg)`;

        // Ejecutar los premios al finalizar por completo la animación (1s + 1.2s = 2.2s totales)
        setTimeout(() => {
            if (typeof onComplete === 'function') onComplete();
        }, 1200);

    }, 1000);
}
window.lanzarMoneda = async function(eleccionUsuario) {
    let datosMoneda = JSON.parse(localStorage.getItem('sistema_moneda_birria'));
    
    if (!datosMoneda) {
        datosMoneda = { intentosDisponibles: 3, ultimaFranjaRegistrada: "inicial" };
    }

    if (datosMoneda.intentosDisponibles <= 0) {
        console.warn("⚠️ No hay intentos disponibles.");
        return;
    }

    // Descontar intento localmente y guardarlo
    datosMoneda.intentosDisponibles = Math.max(0, datosMoneda.intentosDisponibles - 1);
    localStorage.setItem('sistema_moneda_birria', JSON.stringify(datosMoneda));

    if (typeof actualizarInterfazMoneda === 'function') {
        actualizarInterfazMoneda();
    }

    const modalMoneda = document.getElementById('modal-pantalla-completa-moneda');
    const esModalAbierto = modalMoneda && window.getComputedStyle(modalMoneda).display !== 'none';

    const coin = document.getElementById(esModalAbierto ? 'birria-coin-fs' : 'birria-coin');
    const resultText = document.getElementById(esModalAbierto ? 'coin-result-text-fs' : 'coin-result-text');
    
    if (!coin || !resultText) return;

    resultText.style.display = 'block';
    resultText.innerText = "¡Lanzando moneda al aire...";

    const premios = [10, 25, 50, 100, 500];
    let premioCara = premios[Math.floor(Math.random() * premios.length)];
    let premioCruz = premios[Math.floor(Math.random() * premios.length)];
   
    while (premioCara === premioCruz) {
        premioCruz = premios[Math.floor(Math.random() * premios.length)];
    }

    const imagenMonedaHtml = `<img src="/static/images/birriacoin.png" alt="🪙" style="width: 35px; vertical-align: middle; margin-left: 4px;">`;

    const caraLabelFS = document.querySelector('#birria-coin-fs > div:nth-child(1) span');
    const cruzLabelFS = document.querySelector('#birria-coin-fs > div:nth-child(2) span');
    const caraLabelNormal = document.querySelector('#birria-coin > div:nth-child(1) span');
    const cruzLabelNormal = document.querySelector('#birria-coin > div:nth-child(2) span');

    if (caraLabelFS) caraLabelFS.innerText = premioCara;
    if (cruzLabelFS) cruzLabelFS.innerText = premioCruz;
    if (caraLabelNormal) caraLabelNormal.innerText = premioCara;
    if (cruzLabelNormal) cruzLabelNormal.innerText = premioCruz;

    const caraValorLabel = document.getElementById(esModalAbierto ? 'cara-valor-label-fs' : 'cara-valor-label');
    const cruzValorLabel = document.getElementById(esModalAbierto ? 'cruz-valor-label-fs' : 'cruz-valor-label');

    if (caraValorLabel) caraValorLabel.innerHTML = `+${premioCara} ${imagenMonedaHtml}`;
    if (cruzValorLabel) cruzValorLabel.innerHTML = `+${premioCruz} ${imagenMonedaHtml}`;

    const resultadoReal = Math.random() < 0.5 ? 'cara' : 'cruz';
    const premioGanado = resultadoReal === 'cara' ? premioCara : premioCruz;

    simularLanzamientoMoneda(coin, resultadoReal, async () => {
        resultText.innerText = ""; 
        
        // Si el usuario acierta, sumamos el premio y se guarda en Firebase automáticamente
        if (eleccionUsuario === resultadoReal) {
            if (typeof window.modificarMonedas === 'function') {
                await window.modificarMonedas(premioGanado, true); // true = sumar
            } else {
                const display = document.getElementById('user-birriacoins') || document.getElementById('coins-amount');
                if (display) {
                    let saldoActual = parseInt(display.textContent.replace(/,/g, '')) || 0;
                    display.textContent = (saldoActual + premioGanado).toLocaleString();
                }
            }
            mostrarModalResultadoMoneda(true, premioGanado);
        } else {
            // Si pierde, no sumamos nada (o si deseas restar por fallar, puedes usar window.modificarMonedas(cantidad, false))
            mostrarModalResultadoMoneda(false, 0);
        }
    });
};
window.lanzarMonedaFS = function(eleccionUsuario) {
    window.lanzarMoneda(eleccionUsuario);
};

function calcularEstadoMoneda() {
    let datosMoneda = JSON.parse(localStorage.getItem('sistema_moneda_birria'));

    const ahora = new Date();
    const hora = ahora.getHours();
    const minuto = ahora.getMinutes();
    const segundo = ahora.getSeconds();
    
    const segundoActualTotal = hora * 3600 + minuto * 60 + segundo;

    const franjas = [
        { id: 8, segundos: 8 * 3600 },
        { id: 15, segundos: 15 * 3600 },
        { id: 22, segundos: 22 * 3600 }
    ];

    let proximaFranja = franjas.find(f => f.segundos > segundoActualTotal);
    let segundosRestantes = 0;
    
    if (proximaFranja) {
        segundosRestantes = proximaFranja.segundos - segundoActualTotal;
    } else {
        segundosRestantes = (24 * 3600 - segundoActualTotal) + (8 * 3600);
    }

    // Si no existe el registro en el localStorage, lo inicializamos limpio con 3
    if (!datosMoneda) {
        datosMoneda = { 
            intentosDisponibles: 3, 
            ultimaFranjaRegistrada: `${ahora.getFullYear()}-${ahora.getMonth()}-${ahora.getDate()}` 
        };
        localStorage.setItem('sistema_moneda_birria', JSON.stringify(datosMoneda));
    }

    return {
        intentos: Number(datosMoneda.intentosDisponibles) || 0,
        segundosRestantes: Number(segundosRestantes) || 0
    };
}

function actualizarInterfazMoneda() {
    const estado = calcularEstadoMoneda();
    const intentosActuales = estado.intentos;

    const textoEsquina = document.getElementById('texto-tickets-esquina');
    if (textoEsquina) {
        textoEsquina.innerText = `${intentosActuales} / 3`;
    }

    let horas = Math.floor(estado.segundosRestantes / 3600);
    let minutos = Math.floor((estado.segundosRestantes % 3600) / 60);
    let segundos = estado.segundosRestantes % 60;

    const strH = String(horas).padStart(2, '0');
    const strM = String(minutos).padStart(2, '0');
    const strS = String(segundos).padStart(2, '0');

    ['timer-horas', 'timer-horas-ruleta'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerText = strH;
    });
    ['timer-min', 'timer-min-ruleta'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerText = strM;
    });
    ['timer-seg', 'timer-seg-ruleta'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerText = strS;
    });

    const modalMonedaFs = document.getElementById('modal-pantalla-completa-moneda');
    const esFsAbierto = modalMonedaFs && window.getComputedStyle(modalMonedaFs).display !== 'none';

    const botonesJuegoFs = document.getElementById('jugar-botones-container-fs'); 
    const contenedorAgotadoFs = document.getElementById('container-agotado-fs'); 

    if (esFsAbierto) {
        if (intentosActuales <= 0) {
            if (botonesJuegoFs) botonesJuegoFs.style.display = 'none';
            if (contenedorAgotadoFs) contenedorAgotadoFs.style.display = 'flex';
        } else {
            if (botonesJuegoFs) botonesJuegoFs.style.display = 'flex';
            if (contenedorAgotadoFs) contenedorAgotadoFs.style.display = 'none';
        }
    }
}

// Intervalo seguro de actualización por segundo (solo refresca textos y temporizador)
if (!window.timerMonedaInterval) {
    actualizarInterfazMoneda();
    window.timerMonedaInterval = setInterval(() => {
        const modalMonedaFs = document.getElementById('modal-pantalla-completa-moneda');
        if (modalMonedaFs && window.getComputedStyle(modalMonedaFs).display !== 'none') {
            actualizarInterfazMoneda();
        }
    }, 1000);
}
function cerrarModalMoneda() {
    const modal = document.getElementById('modal-premio-moneda');
    if (modal) modal.style.display = 'none';

    const resultText = document.getElementById('coin-result-text');
    const resultTextFs = document.getElementById('coin-result-text-fs');
    if (resultText) resultText.innerHTML = "";
    if (resultTextFs) resultTextFs.innerHTML = "";

    const coinNormal = document.getElementById('birria-coin');
    const coinFs = document.getElementById('birria-coin-fs');

    [coinNormal, coinFs].forEach(coin => {
        if (coin) {
            coin.style.transition = 'none';
            coin.style.transform = 'rotateY(0deg)';
            void coin.offsetWidth; 

            const textoSpan = coin.querySelector('span');
            if (textoSpan) {
                textoSpan.innerText = "CARA";
            }
        }
    });

    if (typeof anguloMonedaTotal !== 'undefined') {
        anguloMonedaTotal = 0;
    }

    // Reactivar los botones de juego únicamente si el usuario todavía tiene intentos disponibles
    let datosMoneda = JSON.parse(localStorage.getItem('sistema_moneda_birria')) || { intentosDisponibles: 0 };
    const botonesJuegoContainer = document.getElementById('jugar-botones-container');
    
    if (botonesJuegoContainer) {
        if (datosMoneda.intentosDisponibles > 0) {
            botonesJuegoContainer.style.pointerEvents = 'auto';
            botonesJuegoContainer.style.opacity = '1';
        } else {
            botonesJuegoContainer.style.pointerEvents = 'none';
            botonesJuegoContainer.style.opacity = '0.5';
        }
    }
}
function mostrarModalResultadoMoneda(esGanador, premioOTexto) {
    const modal = document.getElementById('modal-premio-moneda');
    const contenidoModal = modal ? modal.querySelector('div') : null; // El contenedor interno
    const titulo = document.getElementById('titulo-modal-moneda');
    const texto = document.getElementById('texto-premio-moneda');
    const iconoContenedor = document.getElementById('icono-modal-contenedor');
    const imgMoneda = document.getElementById('img-modal-moneda');

    if (!modal) return;

    // Reiniciar animación limpiando y volviendo a aplicar la clase
    if (contenidoModal) {
        contenidoModal.classList.remove('modal-animado-ruleta');
        void contenidoModal.offsetWidth; // Forzar reflow
        contenidoModal.classList.add('modal-animado-ruleta');
    }

    if (esGanador) {
        titulo.innerText = "🎁 ¡PREMIO! 🎁";
        texto.innerText = `${premioOTexto} BIRRIACOINS`;
        imgMoneda.style.display = 'block';
        imgMoneda.src = "/static/images/birriacoin.png";
        iconoContenedor.style.background = "radial-gradient(circle, #ffd700 0%, #ff8c00 100%)";
        iconoContenedor.style.boxShadow = "0 0 25px rgba(255,215,0,0.6)";
    } else {
        titulo.innerText = "❌ ¡MALA SUERTE! ❌";
        texto.innerText = "SIN PREMIO";
        imgMoneda.style.display = 'none';
        iconoContenedor.style.background = "radial-gradient(circle, #ef4444 0%, #991b1b 100%)";
        iconoContenedor.style.boxShadow = "0 0 25px rgba(239,68,68,0.6)";
    }

    modal.style.display = 'flex';
}

const FRANJAS_HORARIAS = [
    { hora: 8, minuto: 0 },   
    { hora: 15, minuto: 0 },  
    { hora: 22, minuto: 0 }   
];

function obtenerFechaEspana() {
    return new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Madrid" }));
}

// ==========================================
// 1. CÁLCULO DE ESTADO Y FRANJAS (Acumulativo máx. 3)
// ==========================================



function iniciarTemporizadorMoneda() {
    actualizarInterfazMoneda();
    setInterval(actualizarInterfazMoneda, 1000);
}
// Ejecutar al cargar la página
window.addEventListener('DOMContentLoaded', () => {
    iniciarTemporizadorMoneda();
});
// Función para restar el ticket y activar la animación al pulsar los botones de juego
function gastarIntentoMoneda() {
    let datos = JSON.parse(localStorage.getItem('sistema_moneda_birria')) || { intentosDisponibles: 3, tiempoInicioCiclo: Date.now() };
    
    if (datos.intentosDisponibles > 0) {
        datos.intentosDisponibles -= 1;
        
        // Si con este tiro se acaban los intentos, guardamos el momento exacto en que empezó el bloqueo de 3h
        if (datos.intentosDisponibles === 0) {
            datos.tiempoInicioCiclo = Date.now();
        }

        localStorage.setItem('sistema_moneda_birria', JSON.stringify(datos));

        const badgeEsquina = document.getElementById('badge-tickets-esquina');
        if (badgeEsquina) {
            badgeEsquina.classList.remove('anim-ticket-baja');
            void badgeEsquina.offsetWidth; 
            badgeEsquina.classList.add('anim-ticket-baja');
        }

        actualizarInterfazMinijuegosUnico();
        return true;
    }
    return false;
}
// ==========================================
// CONTROL DE MODALES
// ==========================================
window.abrirMonedaPantallaCompleta = function() {
    const modal = document.getElementById("modal-pantalla-completa-moneda");
    if(modal) {
        modal.style.display = "flex";
        
        // Ocultar el premio máximo al abrir el modal para que aparezca solo al tirar
        const contenedorPremioMaxFs = document.getElementById('container-premio-maximo-fs');
        if (contenedorPremioMaxFs) contenedorPremioMaxFs.style.display = 'none';

        const contenidoModal = modal.querySelector('div[style*="background: linear-gradient"]');
        if (contenidoModal) {
            contenidoModal.style.transform = 'scale(1.5)';
            contenidoModal.style.transformOrigin = 'center center';
            contenidoModal.style.margin = '80px auto';
        }

        const coinFs = document.getElementById('birria-coin-fs');
        if (coinFs) {
            coinFs.style.transition = 'none';
            coinFs.style.transform = 'rotateY(0deg)';
            coinFs.style.width = '320px';
            coinFs.style.height = '320px';
            coinFs.style.fontSize = '50px';
            
            const carasMoneda = coinFs.querySelectorAll('div');
            carasMoneda.forEach(cara => {
                cara.style.width = '320px';
                cara.style.height = '320px';
            });

            const imagenesInternas = coinFs.querySelectorAll('img');
            imagenesInternas.forEach(img => {
                img.style.width = '90px';
                img.style.height = '90px';
            });
        }

        const caraFs = document.querySelector('#birria-coin-fs > div:nth-child(1) span');
        const cruzFs = document.querySelector('#birria-coin-fs > div:nth-child(2) span');
        if (caraFs) caraFs.innerText = 'CARA';
        if (cruzFs) cruzFs.innerText = 'CRUZ';

        const resultTextFs = document.getElementById('coin-result-text-fs');
        if (resultTextFs) resultTextFs.innerText = "¡Elige Cara o Cruz para tirar!";
    }
};

window.cerrarMonedaPantallaCompleta = function() {
    const modal = document.getElementById("modal-pantalla-completa-moneda");
    if(modal) {
        modal.style.display = "none";
        
        const contenedorPremioMaxFs = document.getElementById('container-premio-maximo-fs');
        if (contenedorPremioMaxFs) {
            contenedorPremioMaxFs.style.display = 'none';
        }

        const coinFs = document.getElementById('birria-coin-fs');
        if (coinFs) {
            coinFs.style.transition = 'none';
            coinFs.style.transform = 'rotateY(0deg)';
        }


        const caraValorLabelFs = document.getElementById('cara-valor-label-fs');
        const cruzValorLabelFs = document.getElementById('cruz-valor-label-fs');
        if (caraValorLabelFs) caraValorLabelFs.innerHTML = '';
        if (cruzValorLabelFs) cruzValorLabelFs.innerHTML = '';

        const resultTextFs = document.getElementById('coin-result-text-fs');
        if (resultTextFs) {
            resultTextFs.innerText = "¡Elige Cara o Cruz para tirar!";
        }
    }

    // 💡 LLAMADA CLAVE: Refrescar la interfaz al cerrar el modal
    actualizarInterfazMoneda();
};

window.abrirModalConfirmacion = function(nombre, costo) {
    window.premioPendiente = { nombre, costo };
    const modal = document.getElementById('modal-confirmacion');
    if (modal) {
        modal.style.display = 'flex';
    } else {
        console.error("No se encontró el elemento con ID 'modal-confirmacion' en tu HTML");
    }
};

window.abrirModalConfirmacion = function(nombre, costo) {
    window.premioPendiente = { nombre, costo };
    const modal = document.getElementById('modal-confirmacion');
    if (modal) {
        modal.style.display = 'flex';
    } else {
        console.error("No se encontró el elemento con ID 'modal-confirmacion' en tu HTML");
    }
};
// 2. Función que se ejecuta cuando el usuario pulsa el botón verde "Sí, ¡canjear!" del modal
window.ejecutarCompraFinal = async function() {
    if (!window.premioPendiente) return;

    const user = (typeof auth !== 'undefined' && auth.currentUser) ? auth.currentUser : null;
    if (!user) {
        alert("Debes iniciar sesión para canjear.");
        return;
    }

    let monedasActuales = window.birriacoins || 0;
    if (monedasActuales < window.premioPendiente.costo) {
        alert("No tienes suficientes Birriacoins.");
        return;
    }

    // Descontamos las monedas
    monedasActuales -= window.premioPendiente.costo;
    window.birriacoins = monedasActuales;

    // Guardamos en Firebase (asegúrate de que tu función de guardar exista)
    if (typeof window.guardarMonedasEnFirebase === 'function') {
        await window.guardarMonedasEnFirebase(monedasActuales);
    }

    // Cerramos el modal de confirmación y abrimos el de éxito
    const modalConf = document.getElementById('modal-confirmacion');
    if (modalConf) modalConf.style.display = 'none';

    const modalExito = document.getElementById('modal-exito');
    if (modalExito) modalExito.style.display = 'flex';

    window.premioPendiente = null;
}
window.cargarRanking = function() {
    return cargarRankingReal();
}
// Funciones de autenticación con Google mediante redirección de Firebase
window.signInWithRedirect = async function() {
    try {
        if (typeof firebase === 'undefined' || !firebase.auth) {
            console.error("Firebase Auth no está cargado correctamente.");
            return;
        }
        const provider = new firebase.auth.GoogleAuthProvider();
        await firebase.auth().signInWithRedirect(provider);
    } catch (error) {
        console.error("Error en signInWithRedirect:", error);
    }
};

window.getRedirectResult = async function() {
    try {
        if (typeof firebase === 'undefined' || !firebase.auth) return;
        const result = await firebase.auth().getRedirectResult();
        return result;
    } catch (error) {
        console.error("Error en getRedirectResult:", error);
    }
};
document.addEventListener('DOMContentLoaded', () => {
    const btnGoogle = document.getElementById('btn-login-google');
    const btnEmailPass = document.getElementById('btn-email-pass');
    const btnCerrarSesion = document.getElementById('btn-cerrar-sesion');

    // 1. LOGIN CON GOOGLE Y GUARDAR NACIONALIDAD
    if (btnGoogle) {
    btnGoogle.addEventListener('click', async () => {
        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            const result = await firebase.auth().signInWithPopup(provider);
            const user = result.user;

            const userRef = firebase.firestore().collection('usuarios').doc(user.uid);
            const doc = await userRef.get();

            if (!doc.exists) {
                await userRef.set({
                    nombre: user.displayName || 'Usuario Birria',
                    email: user.email,
                    nacionalidad: 'ESPAÑA', // Valor por defecto seguro
                    birriacoins: 100,
                    minutosOnline: 0,
                    fechaCreacion: firebase.firestore.FieldValue.serverTimestamp()
                });
            } else {
                await userRef.update({
                    nombre: user.displayName || doc.data().nombre || 'Usuario'
                });
            }

            localStorage.setItem("usuarioId", user.uid);
            location.reload();
        } catch (error) {
            if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
                return;
            }
            console.error("Error en login con Google:", error);
            alert("Hubo un error al iniciar sesión con Google.");
        }
    });
}
   // 2. LOGIN / REGISTRO CON CORREO Y CONTRASEÑA
    if (btnEmailPass) {
    btnEmailPass.addEventListener('click', async () => {
        const email = document.getElementById('modal-email').value;
        const pass = document.getElementById('modal-pass').value;
        const passConfirm = document.getElementById('modal-pass-confirm')?.value; // Si tienes repetición de contraseña
        const usernameInput = document.getElementById('modal-username')?.value.trim();
        const selectNac = document.getElementById('modal-nacionalidad');
        const nacionalidadElegida = selectNac ? selectNac.value : 'es';

        if (!email || !pass) {
            alert("Por favor, introduce correo y contraseña.");
            return;
        }

        if (!usernameInput) {
            alert("Por favor, introduce un nombre de usuario (username).");
            return;
        }

        try {
            // Registrar usuario nuevo en Firebase Auth
            const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, pass);
            const user = userCredential.user;

            const datosNuevos = {
                nombre: usernameInput,
                username: usernameInput, // <--- Este será el nombre oficial en toda la web
                email: email,
                nacionalidad: nacionalidadElegida,
                birriacoins: 100,
                minutos: 0, // Inicializamos los minutos en 0
                fechaCreacion: firebase.firestore.FieldValue.serverTimestamp()
            };

            // Guardar en Firestore con el UID del usuario
            await firebase.firestore().collection('usuarios').doc(user.uid).set(datosNuevos);
            
            // Guardar localmente y recargar
            localStorage.setItem('usuario_actual', JSON.stringify(datosNuevos));
            alert("¡Registro completado con éxito!");
            location.reload();

        } catch (error) {
            console.error("Error en el registro:", error);
            alert("Error: " + error.message);
        }
    });
}
 
    // 3. CERRAR SESIÓN
    if (btnCerrarSesion) {
        btnCerrarSesion.addEventListener('click', async () => {
            await firebase.auth().signOut();
            location.reload();
        });
    }

    // ⏱️ LÓGICA DEL TEMPORIZADOR DE MINUTOS
    let timerInterval = null;
    let segundosAcumulados = 0;

    function iniciarConteoTiempo() {
        if (timerInterval) clearInterval(timerInterval);

        timerInterval = setInterval(async () => {
            segundosAcumulados++;
            
            // Cada 60 segundos exactos sumamos 1 minuto a Firebase
            if (segundosAcumulados >= 60) {
                segundosAcumulados = 0;
                await sumarMinutosFirebase(1);
            }
        }, 1000);
    }

    function detenerConteoTiempo() {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
    }

    async function sumarMinutosFirebase(minutosA_Sumar) {
        const user = firebase.auth().currentUser;
        if (!user) return;

        try {
            const userRef = firebase.firestore().collection("usuarios").doc(user.uid);
            await firebase.firestore().runTransaction(async (transaction) => {
                const doc = await transaction.get(userRef);
                if (!doc.exists) return;

                const minutosActuales = doc.data().minutos || 0;
                const nuevoTotalMinutos = minutosActuales + minutosA_Sumar;
                
                transaction.update(userRef, { minutos: nuevoTotalMinutos });
            });
        } catch (error) {
            console.error("Error al actualizar los minutos:", error);
        }
    }

    // 4. DETECTAR ESTADO DE LA SESIÓN EN VIVO
  firebase.auth().onAuthStateChanged(async (user) => {
    const perfilHeader = document.getElementById('perfil-usuario-header');
    const nombreDisplay = document.getElementById('nombre-usuario-display');
    const btnNavAuth = document.getElementById('btn-nav-auth');
    const displayMonedas = document.getElementById('user-birriacoins') || document.getElementById('coins-amount');

    if (user) {
        if (perfilHeader) perfilHeader.style.display = 'flex';
        if (btnNavAuth) btnNavAuth.style.display = 'none';

        if (typeof cerrarModalLogin === "function") cerrarModalLogin();
        if (typeof cerrarModalRegistro === "function") cerrarModalRegistro();

        // ⏱️ Activar el temporizador al tener sesión activa
        if (typeof iniciarConteoTiempo === "function") iniciarConteoTiempo();

        try {
            const userRef = firebase.firestore().collection('usuarios').doc(user.uid);
            const userDoc = await userRef.get();
            
            if (userDoc.exists) {
                const data = userDoc.data();
                
                // Priorizar el nombre real guardado en Firestore (username o nombre), si no, usar el email
                const nombreReal = data.username || data.nombre || user.displayName || user.email.split('@')[0];
                
                if (nombreDisplay) {
                    nombreDisplay.textContent = nombreReal;
                }

                // 🖼️ Cargar y mostrar la foto de perfil dinámicamente
                const avatarImg = document.getElementById('avatar-usuario');
                const inicialTexto = document.getElementById('avatar-inicial-texto');
                const urlFoto = data.fotoPerfil || data.avatar;

                if (urlFoto && avatarImg && inicialTexto) {
                    avatarImg.src = urlFoto;
                    avatarImg.style.display = 'block';   // Muestra la imagen
                    inicialTexto.style.display = 'none'; // Oculta la letra por defecto
                }

                // Sincronizar monedas reales y guardar respaldo local
                const monedasReales = data.birriacoins ?? 0;
                if (displayMonedas) displayMonedas.textContent = monedasReales.toLocaleString();
                window.birriacoins = monedasReales;

                // Guardar respaldo local para evitar caídas al navegar
                localStorage.setItem('usuario_actual', JSON.stringify({ ...data, uid: user.uid, email: user.email }));
            } else {
                if (nombreDisplay) {
                    nombreDisplay.textContent = user.displayName || user.email.split('@')[0];
                }
                if (displayMonedas) displayMonedas.textContent = "0";
                window.birriacoins = 0;
            }
        } catch (e) {
            console.error("❌ Error al obtener los datos del usuario:", e);
        }
    } else {
        // 🛡️ PROTECCIÓN CONTRA FALSOS CIERTOS AL CAMBIAR DE PÁGINA
        const usuarioLocal = localStorage.getItem('usuario_actual') || localStorage.getItem('user');

        if (usuarioLocal) {
            console.log("Transición segura: Firebase tardó en responder, pero mantenemos la sesión local.");
        } else {
            // 🛑 Detener el temporizador solo si de verdad no hay sesión
            if (typeof detenerConteoTiempo === "function") detenerConteoTiempo();

            if (perfilHeader) perfilHeader.style.display = 'none';
            if (btnNavAuth) btnNavAuth.style.display = 'block';
            if (displayMonedas) displayMonedas.textContent = "0";
            window.birriacoins = 0;
        }
    }
});
// ==========================================
// APLICAR DATOS EN PANTALLA (Perfil y Monedas)
// ==========================================
window.aplicarDatosEnPantalla = function(data) {
    if (!data) return;

    // 1. Sincronización universal de Monedas (Birriacoins) en toda la web
    const totalMonedas = data.birriacoins ?? data.monedas ?? data.coins ?? 100;
    ['coins-amount', 'coins-amount-profile', 'user-birriacoins'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerText = Number(totalMonedas).toLocaleString();
    });
    window.birriacoins = totalMonedas;

    // 2. Extracción segura de datos de usuario
    let emailUserPart = data.email ? data.email.split('@')[0] : "usuario";
    let nombreReal = (!data.nombre || data.nombre === "Sin nombre" || data.nombre === "Usuario") ? emailUserPart : data.nombre;
    let apellidoReal = (!data.apellido || data.apellido === "Sin apellido") ? "" : data.apellido;
    let usernameReal = (!data.username || data.username === "usuario") ? emailUserPart : data.username;
    
    const emailReal = data.email || "correo@desconocido.com";
    const fnacimientoReal = data.fechaNacimiento || data.fnacimiento || data.birthdate || data.nacimiento || "";
    const nacionalidadReal = data.nacionalidad || "España";

    // 3. Actualización de textos en el DOM (Displays, Header, Perfiles)
    const nombreDisplay = document.getElementById('nombre-usuario-display');
    if (nombreDisplay) nombreDisplay.innerText = usernameReal;

    const nameLeftFull = document.getElementById('user-name-left-full');
    if (nameLeftFull) nameLeftFull.innerText = `\({nombreReal}\){apellidoReal}`.trim();

    const usernamePreview = document.getElementById('username-preview-left');
    if (usernamePreview) usernamePreview.innerText = "@" + usernameReal;

    const emailLeftFull = document.getElementById('user-email-left-full');
    if (emailLeftFull) emailLeftFull.innerText = emailReal;

    const perfilEmail = document.getElementById('perfil-email');
    if (perfilEmail) perfilEmail.innerText = emailReal;

    // 4. Actualización de Inputs del formulario (con soporte para múltiples IDs)
    const ponerInput = (id, val) => { 
        const inp = document.getElementById(id); 
        if (inp) inp.value = val; 
    };

    ponerInput('input-perfil-nombre', nombreReal);
    ponerInput('nombre-input', nombreReal);
    ponerInput('input-perfil-apellido', apellidoReal);
    ponerInput('apellido-input', apellidoReal);
    ponerInput('input-perfil-username', usernameReal);
    ponerInput('username-input', usernameReal);
    ponerInput('input-perfil-nacionalidad', nacionalidadReal);
    ponerInput('nacionalidad', nacionalidadReal);

    // Inputs de fecha de nacimiento
    const inputFecha = document.getElementById('input-perfil-fnacimiento') || document.getElementById('fechaNacimiento') || document.querySelector('input[placeholder*="dd/mm"]') || document.querySelector('input[type="date"]');
    if (inputFecha) {
        inputFecha.value = fnacimientoReal;
    }

    // 5. Sincronización del Avatar / Foto de perfil
    const avatarUrl = data.avatar || data.photoURL || data.fotoPerfil;
    if (avatarUrl && typeof actualizarVistaAvatarLocal === 'function') {
        actualizarVistaAvatarLocal(avatarUrl);
    }
};

document.addEventListener("DOMContentLoaded", () => {
    const usuarioGuardado = JSON.parse(localStorage.getItem('usuario_actual') || localStorage.getItem('user'));
    if (usuarioGuardado) {
        aplicarDatosEnPantalla(usuarioGuardado);
    }

    if (typeof firebase !== 'undefined' && firebase.auth) {
        firebase.auth().onAuthStateChanged(async (userAuth) => {
            const perfilHeader = document.getElementById('perfil-usuario-header');
            const btnNavAuth = document.getElementById('btn-nav-auth');

            if (userAuth) {
                if (perfilHeader) perfilHeader.style.display = 'flex';
                if (btnNavAuth) btnNavAuth.style.display = 'none';

                if (typeof cerrarModalLogin === "function") cerrarModalLogin();
                if (typeof cerrarModalRegistro === "function") cerrarModalRegistro();

                try {
                    const docRef = await firebase.firestore().collection('usuarios').doc(userAuth.uid).get();
                    if (docRef.exists) {
                        const datosUsuario = docRef.data();
                        localStorage.setItem('usuario_actual', JSON.stringify(datosUsuario));
                        aplicarDatosEnPantalla(datosUsuario);
                    }
                } catch (e) {
                    console.error("❌ Error al recuperar datos de Firebase:", e);
                }
            } else {
                // 🛡️ Protección opcional contra falsos cierres al cambiar de página
                const usuarioLocal = localStorage.getItem('usuario_actual') || localStorage.getItem('user');

                if (usuarioLocal) {
                    console.log("Transición segura: manteniendo sesión local mientras reconecta Firebase.");
                } else {
                    if (perfilHeader) perfilHeader.style.display = 'none';
                    if (btnNavAuth) btnNavAuth.style.display = 'block';
                    
                    const displayMonedas = document.getElementById('user-birriacoins') || document.getElementById('coins-amount');
                    if (displayMonedas) displayMonedas.textContent = "0";
                    window.birriacoins = 0;
                }
            }
        });
    }
});
});

// Funciones globales auxiliares para abrir/cerrar el modal desde los botones del menú
// 1. Abrir el modal unificado de acceso (Login / Registro)
window.abrirModalAcceso = function() {
    const modal = document.getElementById('modal-acceso');
    if (modal) {
        modal.style.display = 'flex';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
    }
};

// 2. Cerrar el modal unificado
window.cerrarModalAcceso = function() {
    const modal = document.getElementById('modal-acceso');
    if (modal) {
        modal.style.display = 'none';
    }
};

// 3. Cambiar dinámicamente entre la pestaña de Iniciar Sesión y Registrarse
window.cambiarTab = function(tipo) {
    const formLogin = document.getElementById('form-login-container');
    const formRegistro = document.getElementById('form-registro-container');
    const btnLogin = document.getElementById('btn-tab-login');
    const btnRegistro = document.getElementById('btn-tab-registro');

    if (tipo === 'login') {
        if (formLogin) formLogin.style.display = 'block';
        if (formRegistro) formRegistro.style.display = 'none';
        
        if (btnLogin) {
            btnLogin.style.color = '#ffffff';
            btnLogin.style.opacity = '1';
        }
        if (btnRegistro) {
            btnRegistro.style.color = '#9ca3af';
            btnRegistro.style.opacity = '0.6';
        }
    } else if (tipo === 'registro') {
        if (formLogin) formLogin.style.display = 'none';
        if (formRegistro) formRegistro.style.display = 'block';
        
        if (btnLogin) {
            btnLogin.style.color = '#9ca3af';
            btnLogin.style.opacity = '0.6';
        }
        if (btnRegistro) {
            btnRegistro.style.color = '#ffffff';
            btnRegistro.style.opacity = '1';
        }
    }
};

// 4. Asegurarse de que el modal comience oculto al cargar la página
document.addEventListener("DOMContentLoaded", () => {
    const modal = document.getElementById('modal-acceso');
    if (modal) {
        modal.style.display = 'none';
    }
});
// 1. Iniciar un contador de minutos reales en la sesión actual
let minutosEnWeb = 0;
setInterval(() => {
    minutosEnWeb++;
    // Si el usuario está logueado, puedes guardar este valor en Firestore opcionalmente
}, 60000); // Cada 60,000 ms (1 minuto)

// --- SISTEMA DE ACUMULACIÓN DE MINUTOS ACTIVOS ---
// Esto debe ejecutarse cuando el usuario inicia sesión para sumar 1 minuto cada 60 segundos en Firestore
// --- SISTEMA DE ACUMULACIÓN DE MINUTOS ACTIVOS ---
function iniciarContadorMinutos() {
    const userId = localStorage.getItem("usuarioId") || (firebase.auth().currentUser ? firebase.auth().currentUser.uid : null);
    if (!userId) return;

    setInterval(async () => {
        const userRef = firebase.firestore().collection("usuarios").doc(userId);
        try {
            await firebase.firestore().runTransaction(async (transaction) => {
                const doc = await transaction.get(userRef);
                if (!doc.exists) return;
                const minutosActuales = doc.data().minutosOnline || 0;
                transaction.update(userRef, { minutosOnline: minutosActuales + 1 });
            });
        } catch (error) {
            console.error("Error al actualizar los minutos activos:", error);
        }
    }, 60000);
}

async function cargarRankingReal() {
    const tablaCuerpo = document.getElementById("tabla-ranking-cuerpo");
    if (!tablaCuerpo) return;
    
    tablaCuerpo.innerHTML = ""; 

    const mapaPaises = {
        "es": { nombre: "ESPAÑA", flag: "es.png" }, "mx": { nombre: "MÉXICO", flag: "mx.png" }, 
        "ar": { nombre: "ARGENTINA", flag: "ar.png" }, "co": { nombre: "COLOMBIA", flag: "co.png" }, 
        "cl": { nombre: "CHILE", flag: "cl.png" }, "pe": { nombre: "PERÚ", flag: "pe.png" }, 
        "us": { nombre: "ESTADOS UNIDOS", flag: "us.png" }, "other": { nombre: "OTRO", flag: "other.png" },
        "españa": { nombre: "ESPAÑA", flag: "es.png" }, "méxico": { nombre: "MÉXICO", flag: "mx.png" }, 
        "argentina": { nombre: "ARGENTINA", flag: "ar.png" }, "colombia": { nombre: "COLOMBIA", flag: "co.png" }, 
        "chile": { nombre: "CHILE", flag: "cl.png" }, "perú": { nombre: "PERÚ", flag: "pe.png" }, 
        "peru": { nombre: "PERÚ", flag: "pe.png" }, "estados unidos": { nombre: "ESTADOS UNIDOS", flag: "us.png" }, 
        "alemania": { nombre: "ALEMANIA", flag: "de.png" }, "andorra": { nombre: "ANDORRA", flag: "ad.png" }, 
        "brasil": { nombre: "BRASIL", flag: "br.png" }, "canadá": { nombre: "CANADÁ", flag: "ca.png" }, 
        "francia": { nombre: "FRANCIA", flag: "fr.png" }, "italia": { nombre: "ITALIA", flag: "it.png" }, 
        "japón": { nombre: "JAPÓN", flag: "jp.png" }, "reino unido": { nombre: "REINO UNIDO", flag: "gb.png" }, 
        "venezuela": { nombre: "VENEZUELA", flag: "ve.png" }
    };

    try {
        const snapshot = await firebase.firestore().collection("ranking_publico")
            .orderBy("birriacoins", "desc")
            .limit(10)
            .get();

        let puesto = 1;
        tablaCuerpo.innerHTML = ""; 

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            
            const nombreBruto = data.username || data.nombre || "Jugador_" + docSnap.id.substring(0, 5);

            const nombre = nombreBruto.toUpperCase();
            const inicialUsuario = nombre.charAt(0);
            
            const valorBD = (data.nacionalidad || "españa").toLowerCase().trim();
            const paisInfo = mapaPaises[valorBD] || { nombre: (data.nacionalidad || "ESPAÑA").toUpperCase(), flag: "other.png" };
            const coins = data.birriacoins || 0;
            
            // CORREGIDO: Leemos el campo unificado "minutos" de Firestore
            const minutosReal = data.minutos || data.minutosOnline || 0; 

            // Obtener la URL de la foto de perfil del usuario
            const urlFoto = data.fotoPerfil || data.avatar || "";

            let rowBg = "linear-gradient(90deg, #322348 0%, #201730 100%)";
            let borderColor = "rgba(110, 75, 160, 0.4)";
            let boxShadow = "0 8px 20px rgba(0, 0, 0, 0.3)";
            let textColor = "#ffffff";

            if (puesto === 1) {
                rowBg = "linear-gradient(90deg, #4d315e 0%, #301d3f 100%)";
                borderColor = "rgba(230, 160, 50, 0.6)";
                boxShadow = "0 8px 25px rgba(230, 160, 50, 0.2)";
            }

            const fila = `
                <tr style="background: ${rowBg}; border: 1.5px solid ${borderColor}; box-shadow: ${boxShadow}; border-radius: 16px; transition: all 0.2s ease; cursor: pointer;">
                    <td style="padding: 18px 20px; text-align: center; width: 60px;">
                        <div style="position: relative; display: inline-flex; align-items: center; justify-content: center; width: 42px; height: 48px;">
                            <img src="/static/images/rank.png" style="width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));">
                            <span style="position: absolute; font-family: 'Lilita One', cursive; font-size: 15px; color: #ffffff; text-shadow: 1px 1px 2px rgba(0,0,0,0.9);">${puesto}</span>
                        </div>
                    </td>
                    <td style="padding: 18px 20px; display: flex; align-items: center; gap: 14px;">
                        <!-- FOTO DE PERFIL DINÁMICA EN EL RANKING -->
                        <div style="width: 42px; height: 42px; min-width: 42px; min-height: 42px; border-radius: 50%; overflow: hidden; border: 2px solid #ffd700; background: #8b5cf6; display: flex; align-items: center; justify-content: center; position: relative;">
                            ${urlFoto ? 
                                `<img src="${urlFoto}" style="width: 100%; height: 100%; object-fit: cover;">` : 
                                `<span style="font-family: 'Lilita One', cursive; font-size: 16px; color: white;">${inicialUsuario}</span>`
                            }
                        </div>
                        <div>
                            <div style="font-family: 'Lilita One', cursive; font-size: 18px; color: ${textColor}; letter-spacing: 0.5px; text-shadow: 0 2px 4px rgba(0,0,0,0.4);">${nombre}</div>
                            <div style="display: inline-flex; align-items: center; margin-top: 4px;">
                                <img src="/static/images/timer.png" class="animacion-timer" style="width: 14px; vertical-align: middle; margin-right: 4px;"> 
                                <span style="font-family: 'Lilita One', cursive; font-size: 13px; color: #e879f9; text-shadow: 0 0 8px rgba(232, 121, 249, 0.3);">${minutosReal} min</span>
                            </div>
                        </div>
                    </td>
                    <td style="padding: 18px 20px;">
                        <div style="display: inline-flex; align-items: center; background: rgba(0,0,0,0.25); padding: 6px 12px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.05);">
                            <img src="/static/images/${paisInfo.flag}" style="width: 20px; height: 15px; object-fit: cover; vertical-align: middle; margin-right: 8px; border-radius: 2px;"> 
                            <span style="font-family: 'Lilita One', cursive; font-size: 13px; color: #d4d0e8; letter-spacing: 0.5px;">${paisInfo.nombre}</span>
                        </div>
                    </td>
                    <td style="padding: 18px 20px; text-align: right;">
                        <div style="display: inline-flex; align-items: center; background: rgba(0,0,0,0.3); padding: 6px 14px; border-radius: 20px; border: 1px solid rgba(255,215,0,0.15);">
                            <img src="/static/images/birriacoin.png" style="width: 18px; vertical-align: middle; margin-right: 6px;"> 
                            <span style="font-family: 'Lilita One', cursive; font-size: 16px; color: #ffd700; text-shadow: 0 0 10px rgba(255,215,0,0.3);">${coins.toLocaleString()}</span>
                        </div>
                    </td>
                </tr>
                <tr style="height: 12px;"><td colspan="4" style="background: transparent; border: none;"></td></tr>
            `;
            tablaCuerpo.innerHTML += fila;
            puesto++;
        });
    } catch (error) {
        if (error.code === 'permission-denied') {
            console.warn("El ranking está bloqueado por las reglas de Firestore.");
            tablaCuerpo.innerHTML = '<tr><td colspan="4">El ranking no está disponible temporalmente.</td></tr>';
        } else {
            console.error("Error al cargar el ranking:", error);
            tablaCuerpo.innerHTML = '<tr><td colspan="4">No se pudo cargar el ranking.</td></tr>';
        }
    }
}

// --- CONTROL DE PESTAÑAS DEL MODAL ---
function cambiarTab(tab) {
    const btnLogin = document.getElementById("btn-tab-login");
    const btnRegistro = document.getElementById("btn-tab-registro");
    const formLogin = document.getElementById("form-login-container");
    const formRegistro = document.getElementById("form-registro-container");

    if (tab === 'login') {
        if (btnLogin) btnLogin.style.opacity = "1";
        if (btnRegistro) btnRegistro.style.opacity = "0.6";
        if (formLogin) formLogin.style.display = "block";
        if (formRegistro) formRegistro.style.display = "none";
    } else {
        if (btnLogin) btnLogin.style.opacity = "0.6";
        if (btnRegistro) btnRegistro.style.opacity = "1";
        if (formLogin) formLogin.style.display = "none";
        if (formRegistro) formRegistro.style.display = "block";
    }
}

function abrirSeccionRegistro() {
    cambiarTab('registro');
}

// --- FUNCIÓN DE INICIO DE SESIÓN CON CORREO O NOMBRE DE USUARIO ---
async function enviarLogin(event) {
    event.preventDefault();
    const form = event.target;
    const identificador = form.identificador.value.trim();
    const password = form.password.value;

    try {
        let emailFinal = identificador;

        if (!identificador.includes("@")) {
            alert("Inicia sesión con el correo electrónico de tu cuenta.");
            return;
        }

        const userCredential = await firebase.auth().signInWithEmailAndPassword(emailFinal, password);
        const user = userCredential.user;

        localStorage.setItem("usuarioId", user.uid);
        location.reload();

    } catch (error) {
        console.error("Error al iniciar sesión:", error.code, error.message);
        alert("Error al iniciar sesión: Verifique sus credenciales.");
    }
}

// --- FUNCIÓN DE REGISTRO COMPLETO ---
async function enviarRegistro(event) {
    event.preventDefault();
    const form = event.target;
    
    const nombreUsuario = form.nombre_usuario.value.trim();
    const nacionalidad = form.nacionalidad.value;
    const email = form.email.value.trim();
    const fechaNacimiento = form.fecha_nacimiento.value;
    const password = form.password.value;
    const passwordConfirm = form.password_confirm.value;

    if (password !== passwordConfirm) {
        alert("Las contraseñas no coinciden.");
        return;
    }

    try {
        const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        await firebase.firestore().collection("usuarios").doc(user.uid).set({
            nombre: nombreUsuario,
            email: email,
            nacionalidad: nacionalidad,
            fechaNacimiento: fechaNacimiento,
            birriacoins: 0,
            minutosOnline: 0,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        localStorage.setItem("usuarioId", user.uid);
        location.reload();

    } catch (error) {
        console.error("Error en el registro:", error.code, error.message);
        alert("Error al registrarse: " + error.message);
    }
}
window.abrirMonedaPantallaCompleta = function() {
    const modal = document.getElementById("modal-pantalla-completa-moneda");
    if(modal) {
        modal.style.display = "flex";
        
        const contenedorTimer = document.getElementById('contenedor-timer-moneda-card');
        if(contenedorTimer) {
            contenedorTimer.style.display = 'block';
        }
    }
}

window.cerrarMonedaPantallaCompleta = function() {
    const modal = document.getElementById("modal-pantalla-completa-moneda");
    if(modal) {
        modal.style.display = "none";
        document.getElementById('contenedor-timer-moneda-card').style.display = 'none';
    }
}

function actualizarDatosPerfilSesion() {
    const usuarioLogueado = JSON.parse(localStorage.getItem('usuario_actual') || localStorage.getItem('user')) || null;

    const btnNavAuth = document.getElementById('btn-nav-auth');
    const perfilHeader = document.getElementById('perfil-usuario-header');

    if (usuarioLogueado) {
        if (btnNavAuth) btnNavAuth.style.display = 'none';
        if (perfilHeader) perfilHeader.style.display = 'flex';

        const nombreUsuario = usuarioLogueado.nombre || usuarioLogueado.username || "Jugador";

        // 1. Actualizar Nombre
        const elNombre = document.getElementById('nombre-usuario-display');
        if (elNombre) {
            elNombre.innerText = nombreUsuario;
        }

        // 2. Actualizar Monedas
        const elSaldo = document.getElementById('coins-amount');
        if (elSaldo) {
            elSaldo.innerText = usuarioLogueado.monedas ?? usuarioLogueado.birriacoins ?? 0;
        }

        // 3. Manejo inteligente del Avatar o Iniciales
        const elAvatar = document.getElementById('avatar-usuario');
        const spanInicial = document.getElementById('avatar-inicial-texto');
        const avatarGuardado = localStorage.getItem('avatar_usuario_' + nombreUsuario) || usuarioLogueado.avatar;

        if (avatarGuardado && avatarGuardado.trim() !== "") {
            // Si hay imagen válida, se muestra la imagen y se oculta la letra
            elAvatar.src = avatarGuardado;
            elAvatar.style.display = "block";
            if (spanInicial) spanInicial.style.display = "none";
        } else {
            // Si NO hay imagen, se oculta la etiqueta img y se muestra la inicial del nombre
            if (elAvatar) elAvatar.style.display = "none";
            if (spanInicial) {
                spanInicial.innerText = nombreUsuario.charAt(0).toUpperCase();
                spanInicial.style.display = "flex";
            }
        }
    } else {
        if (btnNavAuth) btnNavAuth.style.display = 'block';
        if (perfilHeader) perfilHeader.style.display = 'none';
    }
}

// Función para cambiar la foto (puedes adaptarla para que abra tu pestaña de perfil si lo prefieres)
function cambiarFotoPerfil() {
    const usuarioLogueado = JSON.parse(localStorage.getItem('usuario_actual') || localStorage.getItem('user'));
    const nombreUsuario = usuarioLogueado ? (usuarioLogueado.nombre || usuarioLogueado.username) : "default";

    const nuevaUrl = prompt("Pega el enlace (URL) de tu nueva imagen de perfil:");
    if (nuevaUrl !== null) { // Si el usuario no cancela
        if (nuevaUrl.trim() !== "") {
            localStorage.setItem('avatar_usuario_' + nombreUsuario, nuevaUrl.trim());
        } else {
            // Si deja el campo vacío, borramos la foto personalizada para que vuelva a usar la inicial
            localStorage.removeItem('avatar_usuario_' + nombreUsuario);
        }
        actualizarDatosPerfilSesion();
    }
}

document.addEventListener("DOMContentLoaded", () => {
    actualizarDatosPerfilSesion();
});

function abrirModalAvatar() {
    document.getElementById('modal-avatar').style.display = 'flex';
}

function cerrarModalAvatar() {
    document.getElementById('modal-avatar').style.display = 'none';
}

// Opción 1: Subir archivo local (convertido a Base64 para guardarlo en localStorage)
function subirAvatarArchivo(event) {
    const archivo = event.target.files[0];
    if (archivo) {
        const lector = new FileReader();
        lector.onload = function(e) {
            const rutaImagen = e.target.result;
            guardarYActualizarAvatar(rutaImagen);
        };
        lector.readAsDataURL(archivo);
    }
}

// Opción 2: Seleccionar Brawler de la carpeta images
function seleccionarBrawlerAvatar(nombreArchivo) {
    const rutaImagen = `/static/images/${nombreArchivo}`;
    guardarYActualizarAvatar(rutaImagen);
}

// Guardar en el almacenamiento local y refrescar la vista en pantalla
async function guardarYActualizarAvatar(urlImagen) {
            // 1. Obtener el usuario actual de Firebase Auth
            const usuarioAuth = firebase.auth().currentUser;
            
            if (usuarioAuth) {
                const uid = usuarioAuth.uid;
                
                try {
                    // 2. Guardar la URL del avatar en Firestore (Colección 'usuarios')
                    await firebase.firestore().collection('usuarios').doc(uid).update({
                        avatar: urlImagen
                    });
                    console.log("Avatar guardado en Firebase correctamente");
                } catch (error) {
                    console.error("Error al guardar el avatar en Firebase:", error);
                }
            }

            // 3. Mantener sincronizado el localStorage por velocidad de carga local
let usuarioLogueado = JSON.parse(localStorage.getItem('usuario_actual') || localStorage.getItem('user')) || {};         
   usuarioLogueado.avatar = urlImagen;
            
            localStorage.setItem('usuario_actual', JSON.stringify(usuarioLogueado));
            if(localStorage.getItem('user')) {
                localStorage.setItem('user', JSON.stringify(usuarioLogueado));
            }

            // 4. Actualizar la interfaz visual y cerrar el modal
            actualizarVistaAvatar(urlImagen);
            cerrarModalAvatar();
        }

function actualizarVistaAvatar(url) {
    const imgPerfil = document.getElementById('img-avatar-perfil');
    const placeholderPerfil = document.getElementById('avatar-placeholder-perfil');
    const imgNavbar = document.getElementById('avatar-usuario');
    const textoNavbar = document.getElementById('avatar-inicial-texto');

    if (url) {
        if(imgPerfil) { imgPerfil.src = url; imgPerfil.style.display = 'block'; }
        if(placeholderPerfil) { placeholderPerfil.style.display = 'none'; }
        
        if(imgNavbar) { imgNavbar.src = url; imgNavbar.style.display = 'block'; }
        if(textoNavbar) { textoNavbar.style.display = 'none'; }
    }
}

// Cargar la imagen al iniciar la página si ya existe una guardada
document.addEventListener("DOMContentLoaded", () => {
    const usuarioLogueado = JSON.parse(localStorage.getItem('usuario_actual') || localStorage.getItem('user')) || null;
    if (usuarioLogueado && usuarioLogueado.avatar) {
        actualizarVistaAvatar(usuarioLogueado.avatar);
    }
});
// --- ESTILOS CSS DINÁMICOS ---
if (!document.getElementById("estilos-ranking-moderno")) {
    const styleSheet = document.createElement("style");
    styleSheet.id = "estilos-ranking-moderno";
    styleSheet.innerHTML = `
        .fila-ranking-animada:hover {
            filter: brightness(0.96);
            transform: scale(1.005);
        }
        @keyframes girarReloj {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .animacion-timer {
            animation: girarReloj 8s linear infinite;
        }
    `;
    document.head.appendChild(styleSheet);
}

window.addEventListener("DOMContentLoaded", () => {
    cargarRankingReal();
    iniciarContadorMinutos();
});

// Forzar la actualización visual al cargar la página para que detecte los intentos actuales
document.addEventListener("DOMContentLoaded", () => {
    if (typeof actualizarInterfazMoneda === 'function') {
        actualizarInterfazMoneda();
    }
});// Funciones globales de modales aseguradas en trivia.js
window.abrirModalAcceso = function() {
    const modal = document.getElementById('auth-modal');
    if (modal) modal.style.display = 'flex';
};

window.cerrarModalLogin = function() {
    const modal = document.getElementById('auth-modal');
    if (modal) modal.style.display = 'none';
};

window.abrirModalRegistro = function() {
    const authModal = document.getElementById('auth-modal');
    const regModal = document.getElementById('registro-modal');
    if (authModal) authModal.style.display = 'none';
    if (regModal) regModal.style.display = 'flex';
};

window.cerrarModalRegistro = function() {
    const regModal = document.getElementById('registro-modal');
    if (regModal) regModal.style.display = 'none';
};window.ejecutarRegistro = async function() {
        const regEmail = document.getElementById('reg-email');
        const regPass = document.getElementById('reg-pass');
        const regPassConfirm = document.getElementById('reg-pass-confirm');
        const regNacionalidad = document.getElementById('reg-nacionalidad');
        const regNacimiento = document.getElementById('reg-nacimiento');

        if (!regEmail || !regPass || !regPassConfirm || !regNacionalidad || !regNacimiento) return;

        const email = regEmail.value.trim();
        const pass = regPass.value;
        const passConfirm = regPassConfirm.value;
        const nacionalidad = regNacionalidad.value;
        const nacimiento = regNacimiento.value;

        if (!email || !pass || !nacimiento) {
            alert("Rellena todos los campos obligatorios.");
            return;
        }

        if (pass.length < 8) {
            alert("La contraseña debe tener al menos 8 caracteres.");
            return;
        }

        if (pass !== passConfirm) {
            alert("Las contraseñas no coinciden.");
            return;
        }

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
            const user = userCredential.user;

            await setDoc(doc(db, "usuarios", user.uid), {
                uid: user.uid,
                email: email,
                nacionalidad: nacionalidad,
                nacimiento: nacimiento,
                createdAt: new Date()
            });

            alert("¡Cuenta registrada con éxito!");
    location.reload();
} catch (error) {
    alert("Error en el registro: " + error.message);
}
};

timerInterval = null;
segundosAcumulados = 0;

function iniciarConteoTiempo() {
    if (timerInterval) clearInterval(timerInterval);

    timerInterval = setInterval(async () => {
        segundosAcumulados++;
        
        // Cada 60 segundos exactos sumamos 1 minuto a Firebase
        if (segundosAcumulados >= 60) {
            segundosAcumulados = 0;
            await sumarMinutosFirebase(1);
        }
    }, 1000);
}

function detenerConteoTiempo() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

async function sumarMinutosFirebase(minutosA_Sumar) {
    const user = firebase.auth().currentUser;
    if (!user) return;

    try {
        const userRef = db.collection("usuarios").doc(user.uid);
        await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(userRef);
            if (!doc.exists) return;

            // Si 'minutos' no existe, lo inicializamos en 0
            const minutosActuales = doc.data().minutos || 0;
            const nuevoTotalMinutos = minutosActuales + minutosA_Sumar;
            
            transaction.update(userRef, { minutos: nuevoTotalMinutos });
        });
        
        // Opcional: Si tienes una función que refresca el ranking visualmente, lánzala aquí
        if (typeof cargarRankingReal === 'function') {
            cargarRankingReal();
        }
    } catch (error) {
        console.error("Error al actualizar los minutos:", error);
    }
}
// 1. Pega aquí la función para leer los datos de Firestore
async function cargarDatosPerfil(user) {
    if (!user) return;

    try {
        const docRef = doc(db, "usuarios", user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            console.log("Datos de la cuenta encontrados:", data);

            // Rellenar campos del perfil si estás en perfil.html
            if (document.getElementById('nombre')) document.getElementById('nombre').value = data.nombre || '';
            if (document.getElementById('username')) document.getElementById('username').value = data.username || '';
            if (document.getElementById('email')) document.getElementById('email').value = data.email || user.email || '';
            if (document.getElementById('reg-nacionalidad')) document.getElementById('reg-nacionalidad').value = data.nacionalidad || 'España';
            if (document.getElementById('reg-nacimiento')) document.getElementById('reg-nacimiento').value = data.nacimiento || '';

            // Rellenar las Birriacoins en toda la web (aquí cogerá los 100 o las que tenga guardadas)
            const birriacoinsElems = document.querySelectorAll('.birriacoins-display, #birriacoins-count, span[data-coins], #user-coins');
            birriacoinsElems.forEach(el => {
                el.textContent = data.birriacoins !== undefined ? data.birriacoins : 0;
            });

        } else {
            console.log("El usuario está autenticado pero no tiene documento creado en Firestore.");
        }
    } catch (error) {
        console.error("Error al cargar los datos del perfil:", error);
    }
}
window.togglePassword = function(idInput, btn) {
    const input = document.getElementById(idInput);
    if (!input) return;

    if (input.type === "password") {
        input.type = "text";
        btn.textContent = "👁️‍🗨️";
    } else {
        input.type = "password";
        btn.textContent = "👁️";
    }
}
// 2. Llámala dentro de tu observador de sesión activo (onAuthStateChanged)
// --- OBSERVADOR DE SESIÓN UNIFICADO ---
firebase.auth().onAuthStateChanged(async (user) => {
    if (user) {
        console.log("Usuario logueado con ID:", user.uid);
        
        // 1. Carga los datos del perfil en tu base de datos
        if (typeof cargarDatosPerfil === 'function') {
            await cargarDatosPerfil(user);
        }
        
        // 2. Activa el conteo de tiempo
        if (typeof iniciarConteoTiempo === 'function') {
            iniciarConteoTiempo();
        }
        
    } else {
        console.log("No hay sesión activa.");
        
        // Detiene el conteo de tiempo si se cierra la sesión
        if (typeof detenerConteoTiempo === 'function') {
            detenerConteoTiempo();
        }
    }
});
