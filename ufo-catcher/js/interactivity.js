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
const REPEAT_MS = 500;
const logPanel = document.getElementById('logPanel');
const centerDot = document.getElementById('centerDot');

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
    const step = parseFloat(stepInput.value) || 0.1;
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
    } else {
        logMessage('Center bed failed');
    }
});

/* ===== REPEAT CONTROL ===== */
function startRepeat(dir) {
    if (moveIntervals.has(dir)) return;
    const id = setInterval(() => moveAxis(dir), REPEAT_MS);
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

/* ===== KEYBOARD HANDLERS ===== */
document.addEventListener('keydown', (e) => {
    // Don't handle keys when typing in inputs
    if (e.target.tagName === 'INPUT') return;

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

/* Prevent scrolling with arrow keys */
window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
    }
});
