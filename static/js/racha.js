/**
 * ============================================================
 * RACHA DIARIA
 * Sistema completo de racha + UI
 * ============================================================
 *
 * FUNCIONES:
 * - Racha diaria
 * - Recompensas aleatorias
 * - 7 recompensas visibles
 * - Temporizador de 24 horas
 * - Reinicio después de 48 horas
 * - Botón flotante 🔥
 * - Modal de racha
 * - Animaciones
 * - Monedas / Gemas / XP / Cajas
 * - Guardado mediante localStorage
 *
 * ============================================================
 */


/* ============================================================
   CONFIGURACIÓN
   ============================================================ */

const STREAK_STORAGE_KEY = 'user_streak_data_v2';

const STREAK_COOLDOWN = 24 * 60 * 60 * 1000;

// Si pasan 48 horas desde el último reclamo,
// la racha vuelve a 0.
const STREAK_RESET_TIME = 48 * 60 * 60 * 1000;

// Número de recompensas que se muestran.
const STREAK_REWARD_COUNT = 7;


/* ============================================================
   RECOMPENSAS
   ============================================================ */

const STREAK_REWARD_POOL = [

    {
        type: 'coins',
        amount: 50,
        label: '50 Birriacoins',
        icon: '🪙',
        rarity: 'common',
        weight: 40
    },

    {
        type: 'coins',
        amount: 100,
        label: '100 Birriacoins',
        icon: '💰',
        rarity: 'rare',
        weight: 25
    },

    {
        type: 'gems',
        amount: 5,
        label: '5 Gemas',
        icon: '💎',
        rarity: 'rare',
        weight: 15
    },

    {
        type: 'gems',
        amount: 15,
        label: '15 Gemas',
        icon: '💎',
        rarity: 'epic',
        weight: 10
    },

    {
        type: 'xp',
        amount: 150,
        label: '150 XP',
        icon: '⚡',
        rarity: 'common',
        weight: 35
    },

    {
        type: 'box',
        amount: 1,
        label: 'Caja Mágica',
        icon: '🎁',
        rarity: 'legendary',
        weight: 5
    }
];


/* ============================================================
   CLASE PRINCIPAL
   ============================================================ */

class StreakSystem {

    constructor() {

        this.data = this.loadData();

        this.validateData();

        this.checkStreakValidity();

        this.initRewards();

        this.saveData();
    }


    /* ========================================================
       DATOS
       ======================================================== */

    loadData() {

        try {

            const saved =
                localStorage.getItem(STREAK_STORAGE_KEY);

            if (saved) {

                const parsed = JSON.parse(saved);

                return {
                    count: Number(parsed.count) || 0,

                    lastClaimTimestamp:
                        Number(parsed.lastClaimTimestamp) || 0,

                    upcomingRewards:
                        Array.isArray(parsed.upcomingRewards)
                            ? parsed.upcomingRewards
                            : []
                };
            }

        } catch (error) {

            console.error(
                'Error cargando la racha:',
                error
            );
        }


        return {
            count: 0,
            lastClaimTimestamp: 0,
            upcomingRewards: []
        };
    }


    saveData() {

        try {

            localStorage.setItem(
                STREAK_STORAGE_KEY,
                JSON.stringify(this.data)
            );

        } catch (error) {

            console.error(
                'Error guardando la racha:',
                error
            );
        }
    }


    validateData() {

        if (
            typeof this.data.count !== 'number' ||
            this.data.count < 0
        ) {

            this.data.count = 0;
        }


        if (
            !Array.isArray(
                this.data.upcomingRewards
            )
        ) {

            this.data.upcomingRewards = [];
        }
    }


    /* ========================================================
       RECOMPENSAS
       ======================================================== */

    generateRandomReward() {

        const totalWeight =
            STREAK_REWARD_POOL.reduce(
                (total, reward) =>
                    total + reward.weight,
                0
            );


        let random =
            Math.random() * totalWeight;


        for (
            const reward of STREAK_REWARD_POOL
        ) {

            if (random < reward.weight) {

                return {
                    ...reward,

                    id:
                        Date.now() +
                        Math.random()
                };
            }


            random -= reward.weight;
        }


        return {
            ...STREAK_REWARD_POOL[0],

            id:
                Date.now() +
                Math.random()
        };
    }


    initRewards() {

        while (
            this.data.upcomingRewards.length <
            STREAK_REWARD_COUNT
        ) {

            this.data.upcomingRewards.push(
                this.generateRandomReward()
            );
        }


        if (
            this.data.upcomingRewards.length >
            STREAK_REWARD_COUNT
        ) {

            this.data.upcomingRewards =
                this.data.upcomingRewards.slice(
                    0,
                    STREAK_REWARD_COUNT
                );
        }
    }


    /* ========================================================
       COMPROBAR RACHA
       ======================================================== */

    checkStreakValidity() {

        if (
            !this.data.lastClaimTimestamp
        ) {

            return;
        }


        const elapsed =
            Date.now() -
            this.data.lastClaimTimestamp;


        if (
            elapsed >= STREAK_RESET_TIME
        ) {

            this.data.count = 0;

            /*
             * La cola de recompensas no se borra.
             * Así el jugador conserva la siguiente
             * secuencia de premios.
             */
            this.saveData();
        }
    }


    /* ========================================================
       ¿PUEDE RECLAMAR?
       ======================================================== */

    canClaim() {

        if (
            !this.data.lastClaimTimestamp
        ) {

            return true;
        }


        return (
            Date.now() -
            this.data.lastClaimTimestamp
        ) >= STREAK_COOLDOWN;
    }


    /* ========================================================
       TIEMPO RESTANTE
       ======================================================== */

    getTimeRemaining() {

        if (this.canClaim()) {

            return 0;
        }


        const nextClaim =
            this.data.lastClaimTimestamp +
            STREAK_COOLDOWN;


        return Math.max(
            0,
            nextClaim - Date.now()
        );
    }


    /* ========================================================
       RECOMPENSA ACTUAL
       ======================================================== */

    getCurrentReward() {

        return (
            this.data.upcomingRewards[0] ||
            null
        );
    }


    /* ========================================================
       RECLAMAR
       ======================================================== */

    claimReward() {

        if (!this.canClaim()) {

            return null;
        }


        if (
            !this.data.upcomingRewards.length
        ) {

            this.initRewards();
        }


        const reward =
            this.data.upcomingRewards.shift();


        if (!reward) {

            return null;
        }


        /*
         * Aumentamos la racha.
         */
        this.data.count += 1;


        /*
         * Guardamos el momento exacto
         * del reclamo.
         */
        this.data.lastClaimTimestamp =
            Date.now();


        /*
         * Añadimos una nueva recompensa
         * al final.
         */
        this.data.upcomingRewards.push(
            this.generateRandomReward()
        );


        this.saveData();


        /*
         * Entregar recompensa.
         */
        this.applyRewardToPlayer(
            reward
        );


        /*
         * Avisar al resto del juego.
         */
        window.dispatchEvent(
            new CustomEvent(
                'streakRewardClaimed',
                {
                    detail: reward
                }
            )
        );


        window.dispatchEvent(
            new Event(
                'playerDataUpdated'
            )
        );


        return reward;
    }


    /* ========================================================
       ENTREGAR RECOMPENSA
       ======================================================== */

    addBirriacoins(amount) {

        const amountToAdd = Math.max(0, Math.floor(Number(amount) || 0));
        if (!amountToAdd) return;

        const display = document.getElementById('coins-amount');
        const shownValue = display
            ? Number(String(display.textContent).replace(/[^\d-]/g, ''))
            : NaN;
        const globalValue = Number(window.birriacoins);
        const storedRaw = localStorage.getItem('birriacoins');
        const storedValue = storedRaw === null ? NaN : Number(storedRaw);
        const currentValue = Number.isFinite(globalValue)
            ? globalValue
            : Number.isFinite(shownValue)
                ? shownValue
                : Number.isFinite(storedValue)
                    ? storedValue
                    : 0;
        const total = currentValue + amountToAdd;

        window.birriacoins = total;
        localStorage.setItem('birriacoins', String(total));
        if (display) display.textContent = total.toLocaleString('es-ES');

        if (typeof window.guardarMonedasEnFirebase === 'function') {
            Promise.resolve(window.guardarMonedasEnFirebase(total)).catch((error) => {
                console.error('No se pudieron guardar las Birriacoins:', error);
            });
        }
    }


    applyRewardToPlayer(reward) {

        if (!reward) return;

        let gems = parseInt(localStorage.getItem('player_gems') || '0', 10);
        let xp = parseInt(localStorage.getItem('player_xp') || '0', 10);
        let boxes = parseInt(localStorage.getItem('player_boxes') || '0', 10);

        switch (reward.type) {
            case 'coins':
                this.addBirriacoins(reward.amount);
                break;
            case 'gems':
                gems += reward.amount;
                localStorage.setItem('player_gems', gems);
                break;
            case 'xp':
                xp += reward.amount;
                localStorage.setItem('player_xp', xp);
                break;
            case 'box':
                boxes += reward.amount;
                localStorage.setItem('player_boxes', boxes);
                break;
        }
    }
}

/* API global para que racha-ui.js pueda usar el sistema. */
window.StreakSystem = StreakSystem;
window.streakManager = window.streakManager || new StreakSystem();

