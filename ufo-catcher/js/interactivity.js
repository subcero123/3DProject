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

/* ===== CLAW TOGGLE STATE ===== */
let clawNextDir = 'down'; // toggles between 'down' and 'up'
const btnClaw = document.getElementById('btn-claw');
const clawLabel = document.getElementById('clawLabel');
let spaceCycleZ = [42.78, 149.78]; // Z coordinates to cycle through
let spaceCycleIndex = 0; // current index in the cycle

/* ===== CLAW SAFETY LIMIT ===== */
const clawZMinInput = document.getElementById('clawZMinInput');
function getClawZMin() { return parseFloat(clawZMinInput?.value) || 39.89; }
let clawZ = 270.1; // will be updated after settings load

/* ===== SETTINGS ELEMENTS ===== */
const printerIpInput  = document.getElementById('printerIp');
const btnTestConn     = document.getElementById('btnTestConnection');
const connectionDot   = document.getElementById('connectionDot');
const connectionLabel = document.getElementById('connectionLabel');
const limitXMinInput  = document.getElementById('limitXMin');
const limitXMaxInput  = document.getElementById('limitXMax');
const limitYMinInput  = document.getElementById('limitYMin');
const limitYMaxInput  = document.getElementById('limitYMax');
const limitZMinInput  = document.getElementById('limitZMin');
const limitZMaxInput  = document.getElementById('limitZMax');
const speedInput      = document.getElementById('speedInput');
const stepInput       = document.getElementById('stepInput');
const btnCenterBed    = document.getElementById('btnCenterBed');

// Initialize clawZ from the actual Z max input
clawZ = parseFloat(limitZMaxInput.value) || 270.1;

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

// Center bed
btnCenterBed.addEventListener('click', async () => {
    const xMin = parseFloat(limitXMinInput.value) || 0;
    const xMax = parseFloat(limitXMaxInput.value) || 220;
    const yMin = parseFloat(limitYMinInput.value) || 0;
    const yMax = parseFloat(limitYMaxInput.value) || 220;
    const zMin = parseFloat(limitZMinInput.value) || 0;
    const zMax = parseFloat(limitZMaxInput.value) || 270;

    logMessage('Centering bed...');
    btnCenterBed.textContent = 'Moving...';
    btnCenterBed.disabled = true;

    const result = await centerBed(xMin, xMax, yMin, yMax, zMin, zMax);

    btnCenterBed.textContent = 'Center Bed';
    btnCenterBed.disabled = false;

    if (result) {
        logMessage('Bed centered');
        clawZ = (zMin + zMax) / 2;
    } else {
        logMessage('Center bed failed');
    }
});

/* ===== REPEAT CONTROL ===== */
function startRepeat(dir, clawDir) {
    if (moveIntervals.has(dir)) return;
    const id = setInterval(() => {
        if (dir === 'claw') {
            moveClaw(clawDir);
        } else {
            moveAxis(dir);
        }
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

/* ===== CLAW MOVEMENT ===== */
async function moveClaw(dir) {
    const step = parseFloat(stepInput.value) || 5;
    if (dir === 'down') {
        const newZ = clawZ - step;
        const zMin = getClawZMin();
        if (newZ < zMin) {
            log('claw', `⚠ Z limit reached (${zMin})`);
            stopRepeat('claw');
            activeKeys.delete('claw');
            deactivateClaw();
            return;
        }
        await moveClawDown(step);
        clawZ = newZ;
        log('claw', `▼ ${step}mm (Z:${clawZ.toFixed(1)})`);
    } else {
        await moveClawUp(step);
        clawZ += step;
        log('claw', `▲ ${step}mm (Z:${clawZ.toFixed(1)})`);
    }
}

/* ===== KEYBOARD HANDLERS ===== */
document.addEventListener('keydown', (e) => {
    // Don't handle keys when typing in inputs
    if (e.target.tagName === 'INPUT') return;

    // --- Space: cycle Z coordinates ---
    if (e.key === ' ') {
        e.preventDefault();
        const targetZ = spaceCycleZ[spaceCycleIndex];
        spaceCycleIndex = (spaceCycleIndex + 1) % spaceCycleZ.length;
        log('claw', `Moving to Z${targetZ.toFixed(2)}...`);
        moveAbsoluteZ(targetZ).then(() => {
            clawZ = targetZ;
            log('claw', `At Z${clawZ.toFixed(1)}`);
        });
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

    // --- Space: claw toggle ---
    if (e.key === ' ') {
        e.preventDefault();
        if (activeKeys.has('claw')) {
            activeKeys.delete('claw');
            stopRepeat('claw');
            deactivateClaw();
            log('claw', `${clawNextDir} released`);
            // Flip direction for next press
            clawNextDir = clawNextDir === 'down' ? 'up' : 'down';
        }
        return;
    }

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

/* ===== CLAW BUTTON MOUSE / TOUCH ===== */
btnClaw.addEventListener('mousedown', (e) => {
    e.preventDefault();
    if (!activeKeys.has('claw')) {
        const dir = clawNextDir;
        activeKeys.add('claw');
        activateClaw(dir);
        log('claw', `${dir} pressed`);
        moveClaw(dir);
        startRepeat('claw', dir);
    }
});

btnClaw.addEventListener('mouseup', () => {
    if (activeKeys.has('claw')) {
        activeKeys.delete('claw');
        stopRepeat('claw');
        deactivateClaw();
        log('claw', `${clawNextDir} released`);
        clawNextDir = clawNextDir === 'down' ? 'up' : 'down';
    }
});

btnClaw.addEventListener('mouseleave', () => {
    if (activeKeys.has('claw')) {
        activeKeys.delete('claw');
        stopRepeat('claw');
        deactivateClaw();
        log('claw', `${clawNextDir} released`);
        clawNextDir = clawNextDir === 'down' ? 'up' : 'down';
    }
});

btnClaw.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (!activeKeys.has('claw')) {
        const dir = clawNextDir;
        activeKeys.add('claw');
        activateClaw(dir);
        log('claw', `${dir} pressed`);
        moveClaw(dir);
        startRepeat('claw', dir);
    }
});

btnClaw.addEventListener('touchend', () => {
    if (activeKeys.has('claw')) {
        activeKeys.delete('claw');
        stopRepeat('claw');
        deactivateClaw();
        log('claw', `${clawNextDir} released`);
        clawNextDir = clawNextDir === 'down' ? 'up' : 'down';
    }
});

/* Prevent scrolling with arrow keys */
window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
    }
});
