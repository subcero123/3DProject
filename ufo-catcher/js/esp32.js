/* ===== ESP32 SERIAL CONNECTION (Web Serial API) ===== */
/* Reads and writes the ESP32 over its USB serial port (COM3 @ 115200).
   The browser shows its own device chooser, so the port is picked once by
   the user and afterwards re-opened automatically on page load. */

const ESP32_BAUD_RATE = 115200;
const ESP32_EXPECTED_PATH = 'COM3';
const ESP32_NEWLINE = '\n';

/* Vendor ids of the usual ESP32 USB bridges, used to auto-detect the board */
const ESP32_VENDOR_IDS = [0x303a, 0x10c4, 0x1a86, 0x0403];

/* ===== STATE ===== */
let esp32Port = null;      // SerialPort granted by the user
let esp32Reader = null;    // reader lock, keeps the port open while reading
let esp32Writer = null;    // writer lock, used to send commands
let esp32Connected = false;
let esp32Buffer = '';      // partial line left over between reads

/* ===== DOM REFERENCES ===== */
const btnEsp32         = document.getElementById('btnEsp32');
const esp32StatusDot   = document.getElementById('esp32StatusDot');
const esp32StatusLabel = document.getElementById('esp32StatusLabel');
const esp32Hint        = document.getElementById('esp32Hint');

/* ===== BROWSER SUPPORT ===== */
const esp32Supported = 'serial' in navigator;

/* ===== WIN DETECTION ===== */
/* The board stays silent: only a lone "0" is treated as a caught prize. */
const ESP32_WIN_POINTS = 100;
const ESP32_WIN_PATTERN = /(^|[^0-9])0([^0-9]|$)/;

/* ===== LOG ===== */
/* Connection events only go to the console, the history stays clean */
function logEsp32Event(message) {
    console.log('[ESP32]', message);
}

/* The only thing written to the command history is a win */
function logEsp32Win() {
    if (typeof logMessage !== 'function') return;
    logMessage(
        `<span style="color:#e94560;font-weight:bold">ESP32</span> ` +
        `Congrats! You won ${ESP32_WIN_POINTS} points`
    );
}

/* ===== UPDATE ESP32 STATUS ===== */
function updateEsp32Status(state, label) {
    if (esp32StatusDot) {
        esp32StatusDot.className = 'status-dot' + (state ? ' ' + state : '');
    }
    if (esp32StatusLabel) {
        esp32StatusLabel.textContent = label;
    }
}

/* ===== UPDATE BUTTON STATE ===== */
function setEsp32Busy(busy, label = 'Connecting...') {
    if (!btnEsp32) return;
    btnEsp32.disabled = busy;
    btnEsp32.textContent = busy
        ? label
        : (esp32Connected ? 'Disconnect ESP32' : 'Connect to ESP32');
}

function setEsp32Connected(connected) {
    esp32Connected = connected;
    if (!btnEsp32) return;
    btnEsp32.textContent = connected ? 'Disconnect ESP32' : 'Connect to ESP32';
    btnEsp32.disabled = false;
}

/* ===== PICK THE ESP32 AMONG THE GRANTED PORTS ===== */
function pickEsp32Port(ports) {
    if (!ports || ports.length === 0) return null;

    const known = ports.find(port => {
        const info = port.getInfo?.();
        return info && ESP32_VENDOR_IDS.includes(info.usbVendorId);
    });

    return known || ports[0];
}

/* ===== DESCRIBE A PORT FOR THE UI ===== */
function describeEsp32Port(port) {
    const info = port?.getInfo?.() || {};
    const vid = info.usbVendorId?.toString(16).padStart(4, '0') || '????';
    const pid = info.usbProductId?.toString(16).padStart(4, '0') || '????';
    return `${ESP32_EXPECTED_PATH} - ${vid}:${pid}`;
}

/* ===== READ LOOP ===== */
async function readEsp32Loop(reader) {
    const decoder = new TextDecoder();
    esp32Buffer = '';

    try {
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            if (value) handleEsp32Chunk(decoder.decode(value, { stream: true }));
        }
    } catch (err) {
        console.error('[ESP32] Read error:', err);
        if (esp32Connected) {
            setEsp32Connected(false);
            updateEsp32Status('error', 'Connection lost');
        }
        return;
    }

    // The loop only ends on disconnectEsp32() (reader cancelled on purpose)
    if (esp32Connected) {
        setEsp32Connected(false);
        logEsp32Event('Connection closed');
        updateEsp32Status('error', 'Disconnected');
    }
}

/* ===== INCOMING DATA: ONLY A "0" COUNTS ===== */
function handleEsp32Chunk(chunk) {
    esp32Buffer += chunk;
    const lines = esp32Buffer.split(/\r?\n/);
    esp32Buffer = lines.pop();

    for (const line of lines) {
        if (ESP32_WIN_PATTERN.test(line)) logEsp32Win();
    }

    // The board may report the catch without a trailing newline
    if (esp32Buffer.trim() === '1') {
        esp32Buffer = '';
        logEsp32Win();
    }
}

/* ===== OPEN AN ALREADY GRANTED PORT ===== */
async function openEsp32Port(port) {
    await port.open({
        baudRate: ESP32_BAUD_RATE,
        dataBits: 8,
        stopBits: 1,
        parity: 'none',
    });

    esp32Port = port;
    esp32Reader = port.readable.getReader();
    esp32Writer = port.writable.getWriter();

    setEsp32Connected(true);
    updateEsp32Status('connected', `Connected (${ESP32_BAUD_RATE})`);
    logEsp32Event(`Connected on ${describeEsp32Port(port)} @ ${ESP32_BAUD_RATE}`);

    readEsp32Loop(esp32Reader);
}

/* ===== CONNECT (asks the user for the port) ===== */
async function connectEsp32() {
    if (!esp32Supported) return;
    if (esp32Connected) return;

    setEsp32Busy(true);

    try {
        const port = await navigator.serial.requestPort();
        await openEsp32Port(port);
    } catch (err) {
        console.error('[ESP32] Connect failed:', err);

        if (err.name === 'NotFoundError') {
            logEsp32Event('Port selection cancelled');
        } else {
            logEsp32Event(`Connect failed: ${err.message}`);
            updateEsp32Status('error', 'Connection failed');
        }

        setEsp32Connected(false);
    }
}

/* ===== DISCONNECT ===== */
async function disconnectEsp32() {
    setEsp32Busy(true, 'Disconnecting...');

    if (esp32Reader) {
        try {
            await esp32Reader.cancel();
        } catch (err) {
            console.error('[ESP32] Cancel reader failed:', err);
        }
        try {
            esp32Reader.releaseLock();
        } catch (err) {
            console.error('[ESP32] Release reader failed:', err);
        }
        esp32Reader = null;
    }

    if (esp32Writer) {
        try {
            esp32Writer.releaseLock();
        } catch (err) {
            console.error('[ESP32] Release writer failed:', err);
        }
        esp32Writer = null;
    }

    if (esp32Port) {
        try {
            await esp32Port.close();
        } catch (err) {
            console.error('[ESP32] Close port failed:', err);
        }
        esp32Port = null;
    }

    esp32Buffer = '';
    setEsp32Connected(false);
    updateEsp32Status('', 'Not connected');
    logEsp32Event('Disconnected');
}

/* ===== SEND A LINE TO THE ESP32 ===== */
async function sendEsp32(line) {
    if (!esp32Connected || !esp32Writer) {
        logEsp32Event('Not connected - command ignored');
        return false;
    }

    const text = String(line);
    const payload = text.endsWith(ESP32_NEWLINE) ? text : text + ESP32_NEWLINE;

    try {
        await esp32Writer.write(new TextEncoder().encode(payload));
        logEsp32Event(`> ${text}`);
        return true;
    } catch (err) {
        console.error('[ESP32] Write failed:', err);
        logEsp32Event(`Send failed: ${err.message}`);
        return false;
    }
}

/* ===== TRIGGER HELPER (usable from twitch.js) ===== */
async function esp32Trigger(command = 'TRIGGER') {
    if (!esp32Connected) {
        logEsp32Event('Trigger ignored - not connected');
        return false;
    }
    return sendEsp32(command);
}

/* ===== BUTTON HANDLER ===== */
if (btnEsp32) {
    btnEsp32.addEventListener('click', async () => {
        if (esp32Connected) {
            await disconnectEsp32();
        } else {
            await connectEsp32();
        }
    });
}

/* ===== INIT / AUTO-RECONNECT ON PAGE LOAD ===== */
document.addEventListener('DOMContentLoaded', async () => {
    setEsp32Connected(false);

    if (!esp32Supported) {
        updateEsp32Status('error', 'Not supported');
        if (esp32Hint) esp32Hint.textContent = 'Requires Chrome or Edge';
        if (btnEsp32) btnEsp32.disabled = true;
        console.warn('[ESP32] Web Serial API not available in this browser');
        return;
    }

    if (esp32Hint) {
        esp32Hint.textContent = `Select ${ESP32_EXPECTED_PATH} in the dialog`;
    }

    // The port stays granted, so reopen it without asking again
    try {
        const port = pickEsp32Port(await navigator.serial.getPorts());
        if (!port) {
            updateEsp32Status('', 'Not connected');
            return;
        }
        await openEsp32Port(port);
    } catch (err) {
        console.error('[ESP32] Auto-connect failed:', err);
        updateEsp32Status('error', 'Not connected');
    }
});
