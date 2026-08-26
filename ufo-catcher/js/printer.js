/* ===== PRINTER CONFIG ===== */
let PRINTER_IP = "192.168.137.34";

function getPrinterUrl() {
    return `http://${PRINTER_IP}/printer/gcode/script`;
}

/* ===== SEND G-CODE TO PRINTER ===== */
async function sendToPrinter(gcode) {
    try {
        const response = await fetch(getPrinterUrl(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ script: gcode }),
        });
        const data = await response.json();
        return data;
    } catch (err) {
        console.error('Printer request failed:', err);
        return null;
    }
}

/* ===== TEST CONNECTION ===== */
async function testConnection() {
    try {
        const response = await fetch(getPrinterUrl(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ script: "M119" }),
        });
        if (response.ok) {
            return { ok: true, status: response.status };
        }
        return { ok: false, status: response.status };
    } catch (err) {
        return { ok: false, error: err.message };
    }
}

/* ===== MOVE RELATIVE (G91) ===== */
async function moveRelative(axis, distance) {
    const gcode = [
        "G91",
        `G1 ${axis}${distance} F3000`,
        "G90",
    ].join("\n");
    return sendToPrinter(gcode);
}

/* ===== CENTER BED (G28 + move to center) ===== */
async function centerBed(xMin, xMax, yMin, yMax, zMin, zMax) {
    const centerX = (xMin + xMax) / 2;
    const centerY = (yMin + yMax) / 2;
    const centerZ = (zMin + zMax) / 2;
    const gcode = [
        "G28",
        "G90",
        `G0 X${centerX} Y${centerY} Z${centerZ} F3000`,
    ].join("\n");
    return sendToPrinter(gcode);
}
