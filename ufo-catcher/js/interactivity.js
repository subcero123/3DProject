/* ===== KEY MAPPING ===== */
const KEY_MAP = {
    'ArrowUp':    'up',
    'ArrowDown':  'down',
    'ArrowLeft':  'left',
    'ArrowRight': 'right',
    'w':          'up',
    'W':          'up',
    's':          'down',
    'S':          'down',
    'a':          'left',
    'A':          'left',
    'd':          'right',
    'D':          'right',
};

const activeKeys = new Set();
const moveIntervals = new Map();
const REPEAT_MS = 300;
const logPanel = document.getElementById('logPanel');
const centerDot = document.getElementById('centerDot');

/* ===== CLAW BUTTON ===== */
const btnClaw = document.getElementById('btn-claw');
const clawLabel = document.getElementById('clawLabel');
let grabInProgress = false;

/* ===== CLAW POSITION TRACKER ===== */
let clawZ = 270.1; // will be updated after settings load

/* ===== FORBIDDEN ZONE (structure) ===== */
const FORBIDDEN_ZONE = { xMin: 0, xMax: 115, yMin: 0, yMax: 158 };
function isInForbiddenZone() {
    const x = printerPosition.x;
    const y = printerPosition.y;
    // Structure zone
    const inStructure = x >= FORBIDDEN_ZONE.xMin && x <= FORBIDDEN_ZONE.xMax &&
                        y >= FORBIDDEN_ZONE.yMin && y <= FORBIDDEN_ZONE.yMax;
    // Edge danger zone
    const atEdge = y <= 36.00;
    return inStructure || atEdge;
}

function updateForbiddenIndicator() {
    if (!btnClaw) return;
    if (isInForbiddenZone()) {
        btnClaw.classList.add('forbidden');
        btnClaw.classList.remove('safe');
    } else {
        btnClaw.classList.add('safe');
        btnClaw.classList.remove('forbidden');
    }
}

setInterval(updateForbiddenIndicator, 200);

/* ===== SETTINGS ELEMENTS ===== */
const printerIpInput  = document.getElementById('printerIp');
const btnTestConn     = document.getElementById('btnTestConnection');
const connectionDot   = document.getElementById('connectionDot');
const connectionLabel = document.getElementById('connectionLabel');
const speedInput      = document.getElementById('speedInput');
const stepInput       = document.getElementById('stepInput');

/* ===== START GAME (Twitch interaction window) ===== */
const btnStartGame = document.getElementById('btnStartGame');
const gameStatus   = document.getElementById('gameStatus');
const GAME_DURATION_MS = 60 * 1000; // 1 minute
let gameActive = false;
let gameTimer = null;
let gameCountdown = null;
let gameTimerStart = null;

function setGameState(active) {
    gameActive = active;
    if (btnStartGame) {
        btnStartGame.textContent = active ? 'Stop Game' : 'Start Game';
    }
    if (gameStatus) {
        if (active) {
            gameStatus.hidden = false;
            gameStatus.textContent = formatCountdown(GAME_DURATION_MS);
        } else {
            gameStatus.hidden = true;
        }
    }
}

function formatCountdown(ms) {
    const totalSeconds = Math.ceil(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
}

function updateGameStatus() {
    if (gameStatus && gameTimerStart) {
        const remaining = GAME_DURATION_MS - (Date.now() - gameTimerStart);
        gameStatus.textContent = remaining > 0
            ? formatCountdown(remaining)
            : '0:00';
    }
}

function endGame() {
    if (gameTimer) {
        clearTimeout(gameTimer);
        gameTimer = null;
    }
    if (gameCountdown) {
        clearInterval(gameCountdown);
        gameCountdown = null;
    }
    gameTimerStart = null;
    setGameState(false);
    logMessage('Game finished - Twitch commands disabled');
}

function startGame() {
    if (gameActive) {
        // Toggle off if clicked while running
        endGame();
        return;
    }
    setGameState(true);
    gameTimerStart = Date.now();
    logMessage('Game started - Twitch commands enabled for 1:00');
    gameTimer = setTimeout(() => {
        endGame();
    }, GAME_DURATION_MS);
    gameCountdown = setInterval(updateGameStatus, 250);
}

btnStartGame.addEventListener('click', startGame);

/* ===== VISUAL FEEDBACK ===== */
function activate(dir) {
    const btn = document.getElementById(`btn-${dir}`);
    if (btn) btn.classList.add('active');
    centerDot.classList.add('active');
}

function deactivate(dir) {
    const btn = document.getElementById(`btn-${dir}`);
    if (btn) btn.classList.remove('active');
    if (activeKeys.size === 0) centerDot.classList.remove('active');
}

/* ===== LOG ===== */
function log(dir, action) {
    const now = new Date();
    const time = now.toTimeString().slice(0, 8);
    const entry = document.createElement('div');
    entry.className = 'entry';
    entry.innerHTML = `<span class="time">${time}</span><span class="dir">${dir}</span> <span>${action}</span>`;

    // Remove "Waiting for input..." placeholder
    if (logPanel.children.length === 1 && logPanel.firstElementChild.textContent.includes('Waiting')) {
        logPanel.innerHTML = '';
    }

    logPanel.appendChild(entry);
    logPanel.scrollTop = logPanel.scrollHeight;

    // Keep max 50 entries
    while (logPanel.children.length > 50) {
        logPanel.removeChild(logPanel.firstChild);
    }
}

function logMessage(msg) {
    const now = new Date();
    const time = now.toTimeString().slice(0, 8);
    const entry = document.createElement('div');
    entry.className = 'entry';
    entry.innerHTML = `<span class="time">${time}</span><span>${msg}</span>`;

    if (logPanel.children.length === 1 && logPanel.firstElementChild.textContent.includes('Waiting')) {
        logPanel.innerHTML = '';
    }

    logPanel.appendChild(entry);
    logPanel.scrollTop = logPanel.scrollHeight;

    while (logPanel.children.length > 50) {
        logPanel.removeChild(logPanel.firstChild);
    }
}

/* ===== SETTINGS HANDLERS ===== */

// Update printer IP on change
printerIpInput.addEventListener('change', () => {
    PRINTER_IP = printerIpInput.value.trim();
    logMessage(`IP updated: ${PRINTER_IP}`);
});

// Test connection
btnTestConn.addEventListener('click', async () => {
    PRINTER_IP = printerIpInput.value.trim();
    btnTestConn.textContent = 'Testing...';
    btnTestConn.disabled = true;

    const result = await testConnection();

    btnTestConn.textContent = 'Test Connection';
    btnTestConn.disabled = false;

    if (result.ok) {
        connectionDot.className = 'status-dot connected';
        connectionLabel.textContent = `Connected (${result.status})`;
        logMessage(`Printer connected: ${PRINTER_IP}`);
        // Reconnect WebSocket after successful test
        if (typeof disconnectWebSocket === 'function' && typeof connectWebSocket === 'function') {
            disconnectWebSocket();
            setTimeout(connectWebSocket, 500);
        }
    } else {
        connectionDot.className = 'status-dot error';
        connectionLabel.textContent = result.error || `Failed (${result.status})`;
        logMessage(`Connection failed: ${result.error || result.status}`);
    }
});

/* ===== CLAW VISUAL FEEDBACK ===== */
function activateClaw(dir) {
    if (btnClaw) {
        btnClaw.classList.remove('active-down', 'active-up');
        btnClaw.classList.add(`active-${dir}`);
    }
}

function deactivateClaw() {
    if (btnClaw) btnClaw.classList.remove('active-down', 'active-up');
}

/* ===== MOVEMENT ===== */
const DIR_AXIS = {
    up:    'Y',
    down:  'Y',
    left:  'X',
    right: 'X',
};

const DIR_SIGN = {
    up:    '+',
    down:  '-',
    left:  '-',
    right: '+',
};

async function moveAxis(dir) {
    if (grabInProgress) return;
    const axis = DIR_AXIS[dir];
    const sign = DIR_SIGN[dir];
    const step = parseFloat(stepInput.value) || 5;
    const distance = `${sign}${step}`;

    logMessage(`${axis}${distance} mm`);
    const result = await moveRelative(axis, distance);
    if (!result) {
        logMessage('Move failed');
    }
}

/* ===== REPEAT CONTROL ===== */
function startRepeat(dir) {
    if (moveIntervals.has(dir)) return;
    const id = setInterval(() => {
        moveAxis(dir);
    }, REPEAT_MS);
    moveIntervals.set(dir, id);
}

function stopRepeat(dir) {
    const id = moveIntervals.get(dir);
    if (id) {
        clearInterval(id);
        moveIntervals.delete(dir);
    }
}

function stopAllRepeats() {
    moveIntervals.forEach((id) => clearInterval(id));
    moveIntervals.clear();
}

/* ===== GRAB (down to pick Z, up to travel Z) ===== */
const GRAB_Z_PICK = 29.25;   // lower the claw here to pick a prize
const GRAB_Z_RAISE = 140; // raise the machine here after picking

/* ===== POST-GRAB DROP MOVES (XY, in order) ===== */
const GRAB_DROP_MOVES = [
    { axis: 'Y', pos: 125 },
    { axis: 'X', pos: 55 },
    { axis: 'Y', pos: 25 },
];

/* ===== GRAB END POSITION (final XY + raised Z) ===== */
// Used to detect when the grab sequence is fully finished.
const GRAB_TARGET = {
    x: 55,
    y: 25,
    z: GRAB_Z_RAISE,
};
const GRAB_POS_TOLERANCE = 2.0;
let grabCheckTimer = null;

function isGrabFinished() {
    const p = printerPosition;
    return Math.abs(p.x - GRAB_TARGET.x) <= GRAB_POS_TOLERANCE &&
           Math.abs(p.y - GRAB_TARGET.y) <= GRAB_POS_TOLERANCE &&
           Math.abs(p.z - GRAB_TARGET.z) <= GRAB_POS_TOLERANCE;
}

function setGrabLock(locked) {
    grabInProgress = locked;
    if (clawLabel) {
        clawLabel.textContent = locked ? 'GRABBING!' : 'GRAB';
    }
}

// Poll until the printer reaches the grab end position,
// then release the lock that excludes other commands.
function scheduleGrabUnlock() {
    if (grabCheckTimer) clearInterval(grabCheckTimer);
    grabCheckTimer = setInterval(() => {
        if (isGrabFinished()) {
            clearInterval(grabCheckTimer);
            grabCheckTimer = null;
            setGrabLock(false);
            deactivateClaw();
            log('claw', 'Grab finished - lock released');
        }
    }, 500);
}

async function grab() {
    if (grabInProgress) return;
    if (isInForbiddenZone()) {
        log('claw', '⚠ Blocked: inside structure zone');
        return;
    }
    setGrabLock(true);
    stopAllRepeats();

    // Whole grab sequence in a single combined g-code script:
    // Z down to pick -> Z up to raise -> XY travel to drop-off.
    const moves = [
        `G1 Z${GRAB_Z_PICK} F600`,
        `G1 Z${GRAB_Z_RAISE} F600`,
        ...GRAB_DROP_MOVES.map(m => `G1 ${m.axis}${m.pos} F3000`),
    ];
    const gcode = ["G90", ...moves].join("\n");

    activateClaw('down');
    log('claw', 'Sending combined grab g-code:');
    for (const line of gcode.split('\n')) {
        log('claw', line);
    }

    const result = await sendToPrinter(gcode);

    if (!result) {
        log('claw', 'Grab failed');
        setGrabLock(false);
        deactivateClaw();
    } else {
        log('claw', 'Grab sequence sent - waiting for final position...');
        scheduleGrabUnlock();
    }
}

/* ===== KEYBOARD HANDLERS ===== */
document.addEventListener('keydown', (e) => {
    // Don't handle keys when typing in inputs
    if (e.target.tagName === 'INPUT') return;

    // --- Space: grab (down then up) ---
    if (e.key === ' ') {
        e.preventDefault();
        if (e.repeat) return;
        grab();
        return;
    }

    const dir = KEY_MAP[e.key];
    if (!dir) return;
    e.preventDefault();

    if (!activeKeys.has(dir)) {
        activeKeys.add(dir);
        activate(dir);
        log(dir, 'pressed');
        moveAxis(dir);
        startRepeat(dir);
    }
});

document.addEventListener('keyup', (e) => {
    if (e.target.tagName === 'INPUT') return;

    const dir = KEY_MAP[e.key];
    if (!dir) return;
    e.preventDefault();

    activeKeys.delete(dir);
    stopRepeat(dir);
    deactivate(dir);
    log(dir, 'released');
});

/* ===== MOUSE / TOUCH SUPPORT ===== */
document.querySelectorAll('.arrow-btn').forEach(btn => {
    const dir = btn.dataset.dir;

    btn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        activeKeys.add(dir);
        activate(dir);
        log(dir, 'pressed');
        moveAxis(dir);
        startRepeat(dir);
    });

    btn.addEventListener('mouseup', () => {
        activeKeys.delete(dir);
        stopRepeat(dir);
        deactivate(dir);
        log(dir, 'released');
    });

    btn.addEventListener('mouseleave', () => {
        if (activeKeys.has(dir)) {
            activeKeys.delete(dir);
            stopRepeat(dir);
            deactivate(dir);
            log(dir, 'released');
        }
    });

    // Touch
    btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        activeKeys.add(dir);
        activate(dir);
        log(dir, 'pressed');
        moveAxis(dir);
        startRepeat(dir);
    });

    btn.addEventListener('touchend', () => {
        activeKeys.delete(dir);
        stopRepeat(dir);
        deactivate(dir);
        log(dir, 'released');
    });
});

/* ===== CLAW BUTTON (grab) ===== */
btnClaw.addEventListener('mousedown', (e) => {
    e.preventDefault();
    grab();
});

btnClaw.addEventListener('touchstart', (e) => {
    e.preventDefault();
    grab();
});

/* Prevent scrolling with arrow keys */
window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
    }
});
