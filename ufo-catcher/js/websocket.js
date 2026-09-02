/* ===== MOONRAKER WEBSOCKET CLIENT ===== */
/* Connects to Moonraker's WebSocket API to receive real-time printer position updates. */

let printerWs = null;
let wsReconnectTimer = null;
let wsRequestId = 0;
let wsConnected = false;

/* ===== POSITION STATE ===== */
const printerPosition = { x: 0, y: 0, z: 0, e: 0 };

/* ===== DOM REFERENCES ===== */
const positionDisplay = document.getElementById('positionDisplay');
const wsStatusDot = document.getElementById('wsStatusDot');
const wsStatusLabel = document.getElementById('wsStatusLabel');

/* ===== GET WEBSOCKET URL ===== */
function getWsUrl() {
    return `ws://${PRINTER_IP}/websocket`;
}

/* ===== UPDATE POSITION DISPLAY ===== */
function updatePositionDisplay() {
    if (!positionDisplay) return;
    positionDisplay.innerHTML =
        `<span>X</span><span class="pos-val">${printerPosition.x.toFixed(2)}</span>` +
        `<span>Y</span><span class="pos-val">${printerPosition.y.toFixed(2)}</span>` +
        `<span>Z</span><span class="pos-val">${printerPosition.z.toFixed(2)}</span>` +
        `<span>E</span><span class="pos-val">${printerPosition.e.toFixed(2)}</span>`;
}

/* ===== UPDATE WEBSOCKET STATUS ===== */
function updateWsStatus(connected, label) {
    if (wsStatusDot) {
        wsStatusDot.className = 'status-dot ' + (connected ? 'connected' : '');
    }
    if (wsStatusLabel) {
        wsStatusLabel.textContent = label || (connected ? 'Connected' : 'Disconnected');
    }
}

/* ===== SUBSCRIBE TO TOOLHEAD POSITION ===== */
function subscribeToPosition() {
    if (!printerWs || printerWs.readyState !== WebSocket.OPEN) return;

    wsRequestId++;

    printerWs.send(JSON.stringify({
        jsonrpc: "2.0",
        method: "printer.objects.subscribe",
        params: {
            objects: {
                gcode_move: null,
                toolhead: ["position", "status"]
            }
        },
        id: wsRequestId
    }));

    console.log('[WS] Subscribed to toolhead position');
}

/* ===== CONNECT TO MOONRAKER WEBSOCKET ===== */
function connectWebSocket() {
    // Avoid duplicate connections
    if (printerWs && (printerWs.readyState === WebSocket.OPEN || printerWs.readyState === WebSocket.CONNECTING)) {
        return;
    }

    const url = getWsUrl();
    console.log(`[WS] Connecting to ${url}...`);

    try {
        printerWs = new WebSocket(url);
    } catch (err) {
        console.error('[WS] Failed to create WebSocket:', err);
        scheduleReconnect();
        return;
    }

    printerWs.onopen = () => {
        wsConnected = true;
        console.log('[WS] Connected');
        updateWsStatus(true, 'Connected');
        subscribeToPosition();

        if (wsReconnectTimer) {
            clearTimeout(wsReconnectTimer);
            wsReconnectTimer = null;
        }
    };

    printerWs.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);

            // Handle initial subscribe response
            const position = data?.status?.toolhead?.position;
            // Handle live updates via notify_status_update
            const updatePos = data?.method === 'notify_status_update'
                ? data?.params?.[0]?.toolhead?.position
                : null;

            const pos = position || updatePos;
            if (pos) {
                const [x, y, z, e] = pos;
                printerPosition.x = x;
                printerPosition.y = y;
                printerPosition.z = z;
                printerPosition.e = e;

                updatePositionDisplay();

                // Also update the clawZ tracker in interactivity.js
                if (typeof clawZ !== 'undefined') {
                    clawZ = z;
                }
            }
        } catch (err) {
            console.error('[WS] Error parsing message:', err);
        }
    };

    printerWs.onerror = (error) => {
        console.error('[WS] Error:', error);
    };

    printerWs.onclose = (event) => {
        wsConnected = false;
        console.log(`[WS] Disconnected (code: ${event.code})`);
        updateWsStatus(false, 'Disconnected');
        scheduleReconnect();
    };
}

/* ===== RECONNECT LOGIC ===== */
function scheduleReconnect() {
    if (wsReconnectTimer) return;

    wsReconnectTimer = setTimeout(() => {
        wsReconnectTimer = null;
        console.log('[WS] Attempting reconnect...');
        connectWebSocket();
    }, 3000);
}

/* ===== DISCONNECT ===== */
function disconnectWebSocket() {
    if (wsReconnectTimer) {
        clearTimeout(wsReconnectTimer);
        wsReconnectTimer = null;
    }
    if (printerWs) {
        printerWs.close();
        printerWs = null;
    }
    wsConnected = false;
    updateWsStatus(false, 'Disconnected');
}

/* ===== AUTO-CONNECT ON LOAD ===== */
document.addEventListener('DOMContentLoaded', () => {
    connectWebSocket();
});

/* ===== RE-CONNECT WHEN PRINTER IP CHANGES ===== */
// Override the existing printerIpInput listener to also reconnect WebSocket
const _originalIpListener = printerIpInput?.getAttribute('data-ws-listened');
if (printerIpInput && !_originalIpListener) {
    printerIpInput.setAttribute('data-ws-listened', 'true');
    printerIpInput.addEventListener('change', () => {
        disconnectWebSocket();
        setTimeout(connectWebSocket, 500);
    });
}
