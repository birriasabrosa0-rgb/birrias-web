/**
 * ============================================================
 * RACHA DIARIA - INTERFAZ
 * No modifica la lógica de StreakSystem.
 * Solo crea el botón y la ventana visual.
 * ============================================================
 */

(function () {

    'use strict';

    let uiStarted = false;


    /* ========================================================
       INICIAR
       ======================================================== */

    function startStreakUI() {

        if (uiStarted) return;

        /*
         * streakManager viene de racha.js.
         * Si todavía no existe, esperamos.
         */
        if (
            typeof streakManager === 'undefined'
        ) {
            setTimeout(startStreakUI, 300);
            return;
        }

        uiStarted = true;

        createStreakButton();
        createStreakModal();

        updateStreakUI();

        /*
         * Actualizar reloj cada segundo.
         */
        setInterval(function () {
            updateStreakTimer();

        }, 1000);
    }


    /* ========================================================
       BOTÓN FLOTANTE
       ======================================================== */

    function renderStreakCalendarIcon(dayNumber) {
        const day = Math.max(0, Math.floor(Number(dayNumber) || 0));
        return `
            <svg class="streak-calendar-animation" viewBox="0 0 160 180" role="img" aria-label="Día ${day} de racha">
                <g class="calendar-flame-shape">
                    <path d="M82 8 C88 28 111 34 108 57 C122 47 121 33 119 25 C140 43 151 66 147 91 C143 116 129 132 112 140 L44 134 C26 119 19 99 26 77 C31 60 42 47 55 38 C52 55 60 64 70 67 C67 46 73 23 82 8Z" fill="#ffad23" stroke="#32143f" stroke-width="7" stroke-linejoin="round"/>
                    <path d="M82 37 C87 53 99 61 97 77 C108 69 110 61 109 54 C122 68 126 83 121 99 C116 114 101 123 84 121 C68 120 56 110 54 96 C52 84 58 73 67 66 C67 78 73 83 80 84 C77 67 78 50 82 37Z" fill="#ffe957" stroke="#32143f" stroke-width="5" stroke-linejoin="round"/>
                </g>
                <g class="calendar-page">
                    <path d="M27 54 L132 62 L125 159 L19 150Z" fill="#fff" stroke="#32143f" stroke-width="7" stroke-linejoin="round"/>
                    <path d="M27 54 L132 62 L129 91 L24 83Z" fill="#ffdc28" stroke="#32143f" stroke-width="6" stroke-linejoin="round"/>
                    <path d="M125 159 L119 145 L134 132 L132 151 Q131 158 125 159Z" fill="#30c8e8" stroke="#32143f" stroke-width="5" stroke-linejoin="round"/>
                    <path d="M54 66 C48 53 52 42 59 39 C67 36 73 45 70 62" fill="none" stroke="#32143f" stroke-width="12" stroke-linecap="round"/>
                    <path d="M54 66 C48 53 52 42 59 39 C67 36 73 45 70 62" fill="none" stroke="#ff7b18" stroke-width="7" stroke-linecap="round"/>
                    <path d="M101 70 C95 57 99 46 106 43 C114 40 120 49 117 66" fill="none" stroke="#32143f" stroke-width="12" stroke-linecap="round"/>
                    <path d="M101 70 C95 57 99 46 106 43 C114 40 120 49 117 66" fill="none" stroke="#ff7b18" stroke-width="7" stroke-linecap="round"/>
                    <path d="M39 128 L44 117 L56 116 L47 108 L49 96 L39 102 L29 96 L32 108 L23 116 L35 117Z" fill="#ffe64b" stroke="#32143f" stroke-width="3" stroke-linejoin="round"/>
                    <text class="calendar-day-number" x="83" y="133" text-anchor="middle">${day}</text>
                </g>
            </svg>
        `;
    }
    function renderRewardIcon(reward, compact) {
        if (reward && reward.type === 'coins') {
            const size = compact ? 42 : 76;
            return `<img src="/static/images/birriacoin.png" alt="Birriacoin" style="width:${size}px;height:${size}px;object-fit:contain;">`;
        }

        return reward && reward.icon ? reward.icon : '🎁';
    }

    function setAnimatedText(element, value) {
        const next = String(value);
        const previous = element.textContent.trim();
        if (previous === next) return;

        element.textContent = next;
        if (previous === '') return;

        element.classList.remove('streak-number-change');
        void element.getBoundingClientRect();
        element.classList.add('streak-number-change');
        window.setTimeout(() => element.classList.remove('streak-number-change'), 650);
    }

    function createStreakButton() {

        /*
         * Evitar duplicados.
         */
        if (
            document.getElementById(
                'daily-streak-button'
            )
        ) {
            return;
        }


        const button =
            document.createElement('button');


        button.id =
            'daily-streak-button';


        button.type =
            'button';


        button.className =
            'daily-streak-button';


        button.innerHTML = `

            <div class="streak-button-fire">${renderStreakCalendarIcon(streakManager.data.count)}</div>

            <div class="streak-button-info">

                <div class="streak-button-title">
                    RACHA
                </div>

                <div
                    id="streak-button-days"
                    class="streak-button-days"
                >
                    0 DÍAS
                </div>

            </div>

            <div
                id="streak-button-timer"
                class="streak-button-timer"
            >
                ¡LISTO!
            </div>

        `;


        button.addEventListener(
            'click',
            openStreakModal
        );


        document.body.appendChild(
            button
        );
    }


    /* ========================================================
       MODAL
       ======================================================== */

    function createStreakModal() {

        if (
            document.getElementById(
                'daily-streak-modal'
            )
        ) {
            return;
        }


        const overlay =
            document.createElement('div');


        overlay.id =
            'daily-streak-modal';


        overlay.className =
            'daily-streak-modal';


        overlay.innerHTML = `

            <div class="daily-streak-box">


                <!-- CABECERA -->

                <div class="daily-streak-header">

                    <div class="daily-streak-header-left">

                        <div class="daily-streak-big-fire">${renderStreakCalendarIcon(streakManager.data.count)}</div>

                        <div>

                            <div class="daily-streak-subtitle">
                                RECOMPENSA DIARIA
                            </div>

                            <h2>
                                RACHA DIARIA
                            </h2>

                        </div>

                    </div>


                    <button
                        id="daily-streak-close"
                        class="daily-streak-close"
                        type="button"
                    >
                        ✕
                    </button>

                </div>


                <!-- CONTADOR -->

                <div class="daily-streak-counter">

                    <div
                        id="daily-streak-count"
                        class="daily-streak-count"
                    >
                        0
                    </div>

                    <div class="daily-streak-count-label">
                        DÍAS DE RACHA
                    </div>

                </div>


                <!-- MENSAJE -->

                <div
                    id="daily-streak-message"
                    class="daily-streak-message"
                >
                    🔥 ¡Mantén tu racha!
                </div>


                <!-- RECOMPENSAS -->

                <div
                    id="daily-streak-rewards"
                    class="daily-streak-rewards"
                ></div>


                <!-- RECOMPENSA ACTUAL -->

                <div
                    id="daily-streak-current"
                    class="daily-streak-current"
                ></div>


                <!-- TEMPORIZADOR -->

                <div class="daily-streak-next">

                    <span>
                        PRÓXIMA RECOMPENSA
                    </span>

                    <strong
                        id="daily-streak-modal-timer"
                    >
                        ¡LISTO!
                    </strong>

                </div>


                <!-- RECLAMAR -->

                <button
                    id="daily-streak-claim"
                    class="daily-streak-claim"
                    type="button"
                >
                    🎁 RECLAMAR
                </button>


            </div>

        `;


        document.body.appendChild(
            overlay
        );


        /*
         * Cerrar.
         */

        document
            .getElementById(
                'daily-streak-close'
            )
            .addEventListener(
                'click',
                closeStreakModal
            );


        /*
         * Cerrar haciendo clic fuera.
         */

        overlay.addEventListener(
            'click',
            function (event) {

                if (
                    event.target === overlay
                ) {
                    closeStreakModal();
                }

            }
        );


        /*
         * Reclamar.
         */

        document
            .getElementById(
                'daily-streak-claim'
            )
            .addEventListener(
                'click',
                claimStreak
            );
    }


    /* ========================================================
       ABRIR
       ======================================================== */

    function openStreakModal() {

        updateStreakUI();


        const modal =
            document.getElementById(
                'daily-streak-modal'
            );


        if (!modal) return;


        modal.classList.add(
            'visible'
        );


        document.body.classList.add(
            'streak-modal-open'
        );
    }


    /* ========================================================
       CERRAR
       ======================================================== */

    function closeStreakModal() {

        const modal =
            document.getElementById(
                'daily-streak-modal'
            );


        if (!modal) return;


        modal.classList.remove(
            'visible'
        );


        document.body.classList.remove(
            'streak-modal-open'
        );
    }


    /* ========================================================
       ACTUALIZAR TODO
       ======================================================== */

    function updateStreakUI() {

        if (
            typeof streakManager === 'undefined'
        ) {
            return;
        }


        const data =
            streakManager.data;


        const canClaim =
            streakManager.canClaim();

        document.querySelectorAll('#daily-streak-button .calendar-day-number, #daily-streak-modal .daily-streak-big-fire .calendar-day-number').forEach(function (number) {
            setAnimatedText(number, Number(data.count || 0));
        });


        /*
         * -------------------------
         * BOTÓN
         * -------------------------
         */

        const days =
            document.getElementById(
                'streak-button-days'
            );


        if (days) {

            const count =
                Number(data.count || 0);


            setAnimatedText(days, count === 1 ? '1 DÍA' : `${count} DÍAS`);
        }


        const button =
            document.getElementById(
                'daily-streak-button'
            );


        if (button) {

            button.classList.toggle(
                'ready',
                canClaim
            );

        }


        /*
         * -------------------------
         * CONTADOR DEL MODAL
         * -------------------------
         */

        const modalCount =
            document.getElementById(
                'daily-streak-count'
            );


        if (modalCount) {

            setAnimatedText(modalCount, data.count || 0);
        }


        /*
         * -------------------------
         * MENSAJE
         * -------------------------
         */

        const message =
            document.getElementById(
                'daily-streak-message'
            );


        if (message) {

            message.textContent =
                canClaim
                    ? '🔥 ¡Tu recompensa está disponible!'
                    : '⏳ ¡Vuelve cuando termine el temporizador!';
        }


        /*
         * -------------------------
         * RECOMPENSAS
         * -------------------------
         */

        renderRewards();


        /*
         * -------------------------
         * RECOMPENSA ACTUAL
         * -------------------------
         */

        renderCurrentReward();


        /*
         * -------------------------
         * BOTÓN RECLAMAR
         * -------------------------
         */

        const claim =
            document.getElementById(
                'daily-streak-claim'
            );


        if (claim) {

            claim.disabled =
                !canClaim;


            if (canClaim) {

                claim.textContent =
                    '🎁 RECLAMAR RECOMPENSA';

            } else {

                claim.textContent =
                    `⏳ ${formatStreakUI(
                        streakManager.getTimeRemaining()
                    )}`;
            }
        }


        updateStreakTimer();
    }


    /* ========================================================
       RECOMPENSAS
       ======================================================== */

    function renderRewards() {

        const container =
            document.getElementById(
                'daily-streak-rewards'
            );


        if (!container) return;


        container.innerHTML =
            '';


        const rewards =
            Array.isArray(
                streakManager.data.upcomingRewards
            )
                ? streakManager.data.upcomingRewards
                : [];


        rewards.forEach(
            function (reward, index) {

                const card =
                    document.createElement(
                        'div'
                    );


                card.className = 'daily-streak-reward';
                card.style.setProperty('--reward-index', index);


                if (index === 0) {

                    card.classList.add(
                        'today'
                    );
                }


                const dayNumber =
                    Number(
                        streakManager.data.count || 0
                    ) + index + 1;


                card.innerHTML = `

                    <div class="streak-reward-calendar">${renderStreakCalendarIcon(dayNumber)}</div>


                    <div class="streak-reward-icon">

                        ${
                            renderRewardIcon(reward)
                        }

                    </div>


                    <div class="streak-reward-amount">

                        ${
                            reward.amount ?? ''
                        }

                    </div>


                    <div class="streak-reward-label">

                        ${
                            reward.label || 'Recompensa'
                        }

                    </div>

                `;


                container.appendChild(
                    card
                );

            }
        );
    }


    /* ========================================================
       RECOMPENSA DE HOY
       ======================================================== */

    function renderCurrentReward() {

        const container =
            document.getElementById(
                'daily-streak-current'
            );


        if (!container) return;


        const reward =
            streakManager
                .data
                .upcomingRewards &&
            streakManager
                .data
                .upcomingRewards[0];


        if (!reward) {

            container.innerHTML =
                '';

            return;
        }


        container.innerHTML = `

            <div class="streak-current-icon">
                ${renderRewardIcon(reward, true)}
            </div>

            <div class="streak-current-info">

                <small>
                    RECOMPENSA DE HOY
                </small>

                <strong>
                    ${reward.label || 'Recompensa'}
                </strong>

            </div>

        `;
    }


    /* ========================================================
       TIMER
       ======================================================== */

    function updateStreakTimer() {

        if (
            typeof streakManager === 'undefined'
        ) {
            return;
        }


        const canClaim =
            streakManager.canClaim();

        


        const remaining = streakManager.getTimeRemaining();
        const time = canClaim ? '¡LISTO!' : formatStreakUI(remaining);

        const floatingButton = document.getElementById('daily-streak-button');
        if (floatingButton) floatingButton.classList.toggle('ready', canClaim);

        const claimButton = document.getElementById('daily-streak-claim');
        if (claimButton) {
            claimButton.disabled = !canClaim;
            claimButton.textContent = canClaim
                ? '🎁 RECLAMAR RECOMPENSA'
                : `⏳ ${time}`;
        }

        const message = document.getElementById('daily-streak-message');
        if (message) {
            message.textContent = canClaim
                ? '🔥 ¡Tu recompensa está disponible!'
                : '⏳ ¡Vuelve cuando termine el temporizador!';
        }


        /*
         * Botón flotante.
         */

        const buttonTimer =
            document.getElementById(
                'streak-button-timer'
            );


        if (buttonTimer) {

            buttonTimer.textContent =
                time;
        }


        /*
         * Modal.
         */

        const modalTimer =
            document.getElementById(
                'daily-streak-modal-timer'
            );


        if (modalTimer) {

            modalTimer.textContent =
                time;
        }
    }


    /* ========================================================
       RECLAMAR
       ======================================================== */

    function showRewardCelebration(reward) {
        const previous = document.querySelector('.streak-reward-celebration');
        if (previous) previous.remove();

        const overlay = document.createElement('div');
        overlay.className = 'streak-reward-celebration';
        overlay.setAttribute('role', 'status');
        overlay.setAttribute('aria-live', 'assertive');
        overlay.innerHTML = `
            <div class="streak-reward-celebration-card">
                <div class="streak-reward-celebration-rays" aria-hidden="true">✦</div>
                <div class="streak-reward-celebration-icon">${renderRewardIcon(reward, false)}</div>
                <strong>¡RECOMPENSA CONSEGUIDA!</strong>
                <span>${reward.label || 'Premio diario'}</span>
                <button type="button" class="streak-reward-celebration-close">CONTINUAR</button>
            </div>
            <div class="streak-reward-celebration-confetti" aria-hidden="true">
                ${Array.from({ length: 18 }, () => '<i></i>').join('')}
            </div>
        `;

        document.body.appendChild(overlay);

        const dismiss = () => {
            if (!overlay.isConnected || overlay.classList.contains('is-closing')) return;
            overlay.classList.add('is-closing');
            window.setTimeout(() => overlay.remove(), 220);
        };

        overlay.querySelector('.streak-reward-celebration-close').addEventListener('click', dismiss);
        overlay.addEventListener('click', (event) => {
            if (event.target === overlay) dismiss();
        });
        window.setTimeout(dismiss, 2600);
    }

    function claimStreak() {

        if (
            typeof streakManager === 'undefined'
        ) {
            return;
        }


        const reward =
            streakManager.claimReward();


        if (!reward) {

            updateStreakUI();

            return;
        }


        updateStreakUI();


        showRewardCelebration(reward);
    }


    /* ========================================================
       FORMATO DEL TIEMPO
       ======================================================== */

    function formatStreakUI(ms) {

        if (ms <= 0) {
            return '¡LISTO!';
        }


        const totalSeconds =
            Math.ceil(ms / 1000);


        const hours =
            Math.floor(
                totalSeconds / 3600
            );


        const minutes =
            Math.floor(
                (totalSeconds % 3600) / 60
            );


        const seconds =
            totalSeconds % 60;


        return (
            String(hours).padStart(2, '0') +
            ':' +
            String(minutes).padStart(2, '0') +
            ':' +
            String(seconds).padStart(2, '0')
        );
    }


    /* ========================================================
       ARRANCAR
       ======================================================== */

    if (
        document.readyState ===
        'loading'
    ) {

        document.addEventListener(
            'DOMContentLoaded',
            startStreakUI
        );

    } else {

        startStreakUI();
    }


})();







