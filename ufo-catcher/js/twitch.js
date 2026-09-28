const CLIENT_ID = "x8i6aj0bx5dwwdu6dbg4ix6bkq680r";
const REDIRECT_URI = "http://localhost:3000/ufo-catcher/";

const connectButton = document.getElementById("connectTwitch");
const status = document.getElementById("status");

let twitchAccessToken = null;
let twitchUser = null;
let chatSocket = null;
let chatChannel = null;

let lastGrabber = null;
let winCredited = false;


// ========================================
// 1. CONECTAR CON TWITCH
// ========================================

connectButton.addEventListener("click", () => {

    const state = crypto.randomUUID();

    sessionStorage.setItem("oauth_state", state);

    const params = new URLSearchParams({
        response_type: "token",
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        scope: "chat:read chat:edit",
        state: state
    });

    window.location.href =
        `https://id.twitch.tv/oauth2/authorize?${params.toString()}`;
});


// ========================================
// 2. OBTENER USUARIO
// ========================================

async function getTwitchUser(accessToken) {

    const response = await fetch(
        "https://api.twitch.tv/helix/users",
        {
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Client-Id": CLIENT_ID
            }
        }
    );

    if (!response.ok) {
        throw new Error(
            `Twitch API error: ${response.status}`
        );
    }

    const data = await response.json();

    return data.data[0];
}


// ========================================
// 3. CONECTAR AL CHAT
// ========================================

function connectToChat(channel) {

    console.log(`Connecting to chat #${channel}...`);

    chatChannel = channel;

    chatSocket = new WebSocket(
        "wss://irc-ws.chat.twitch.tv:443"
    );


    chatSocket.onopen = () => {

        console.log("WebSocket connected");

        // Autenticación
        chatSocket.send(
            `PASS oauth:${twitchAccessToken}`
        );

        chatSocket.send(
            `NICK ${twitchUser.login}`
        );

        // Entrar al canal
        chatSocket.send(
            `JOIN #${channel}`
        );
    };


    chatSocket.onmessage = (event) => {

        const message = event.data;

        console.log(message);

        processChatMessage(message);
    };


    chatSocket.onerror = (error) => {

        console.error(
            "WebSocket error:",
            error
        );
    };


    chatSocket.onclose = () => {

        chatChannel = null;

        console.log(
            "WebSocket closed"
        );
    };
}


// ========================================
// 5. ENVIAR MENSAJES AL CHAT
// ========================================

function sendChatMessage(text) {

    if (!chatSocket ||
        chatSocket.readyState !== WebSocket.OPEN ||
        !chatChannel) {

        console.log(
            "Message not sent (chat disconnected):",
            text
        );

        return false;
    }

    chatSocket.send(
        `PRIVMSG #${chatChannel} :${text}`
    );

    console.log(
        "Message sent:",
        text
    );

    return true;
}


// ========================================
// 4. PROCESAR MENSAJES
// ========================================

function processChatMessage(message) {

    // Los mensajes normales de chat contienen PRIVMSG

    if (!message.includes("PRIVMSG")) {
        return;
    }

    // Ejemplo que envía Twitch:
    //
    // :usuario!usuario@usuario.tmi.twitch.tv
    // PRIVMSG #canal :left

    const parts = message.split(" PRIVMSG ");

    if (parts.length < 2) {
        return;
    }

    // Extraer el nombre de usuario del prefijo (":usuario!usuario@...")
    const prefix = parts[0].trim();
    const username = prefix.startsWith(":")
        ? prefix.split("!")[0].substring(1)
        : prefix;

    const chatContent = parts[1];

    const messageParts = chatContent.split(" :");

    if (messageParts.length < 2) {
        return;
    }

    const text = messageParts[1]
        .trim()
        .toLowerCase();

    console.log(
        "Message:",
        text
    );


    // ========================================
    // COMANDOS
    // ========================================

    // Solo procesar comandos durante la ventana de juego activa
    if (!gameActive) {
        return;
    }

    const moveAlias = {
        "left":  "left",
        "l":     "left",
        "right": "right",
        "r":     "right",
        "up":    "up",
        "u":     "up",
        "down":  "down",
        "d":     "down",
    };

    if (moveAlias[text]) {

        const dir = moveAlias[text];

        // Registrar solo los movimientos relevantes,
        // con el usuario en bold y color de acento
        logMessage(
            `<span style="color:#e94560;font-weight:bold">${username}</span>: ${text}`
        );

        // Hacer que el movimiento funcione igual que
        // si se presionara una tecla en interactivity.js
        moveAxis(dir);

    } else if (text === "grab" ||
               text === "claw" ||
               text === "prensa" ||
               text === "agarrar" ||
               text === "g") {

        // El premio del ESP32 se acredita a quien pidió el grab
        registerGrabber(username);

        grab();

    } else if (text === "beep" ||
               text === "bip") {

        if (grabInProgress) {
            logMessage('Beep ignored: grab in progress');
            return;
        }

        const gcode = [
            "M300 S880 P150 ; Play a high-pitch tone for 150ms",
            "G4 P150        ; Dwell/pause for 150ms",
            "M300 S880 P150 ; Play a second tone",
        ].join("\n");

        logMessage("Sending beep g-code:");
        sendToPrinter(gcode);
    }
}


// ========================================
// 6. PREMIOS DETECTADOS POR EL ESP32
// ========================================

// El ESP32 manda "0" cuando atrapa un premio:
// el ganador es el último usuario que pidió el grab

function registerGrabber(username) {

    lastGrabber = username;
    winCredited = false;
}


// Lo llama esp32.js cuando el ESP32 reporta un "0"

function handleEsp32Win() {

    const points =
        typeof ESP32_WIN_POINTS === "number"
            ? ESP32_WIN_POINTS
            : 100;

    // Evita repetir el premio si el ESP32 sigue reportando el mismo 0

    if (winCredited) {
        console.log("ESP32 win already credited, ignoring");
        return;
    }

    winCredited = true;

    if (!lastGrabber) {

        logMessage(
            `<span style="color:#e94560;font-weight:bold">ESP32</span> ` +
            `A prize was caught! (nobody asked for the grab)`
        );

        return;
    }

    logMessage(
        `<span style="color:#e94560;font-weight:bold">ESP32</span> ` +
        `<span style="color:#e94560;font-weight:bold">${lastGrabber}</span> ` +
        `caught a prize! Congrats, you won ${points} points!`
    );

    sendChatMessage(
        `@${lastGrabber}, congratulations! ` +
        `You just won ${points} points!`
    );
}


// ========================================
// 7. PROCESAR OAUTH
// ========================================

async function handleOAuthCallback() {

    const hash = window.location.hash.substring(1);

    if (!hash) {
        return;
    }

    const params = new URLSearchParams(hash);

    const accessToken =
        params.get("access_token");

    const returnedState =
        params.get("state");

    const savedState =
        sessionStorage.getItem("oauth_state");


    if (!accessToken) {
        return;
    }


    if (returnedState !== savedState) {

        console.error(
            "OAuth state invalid"
        );

        return;
    }


    console.log(
        "Access token received"
    );


    twitchAccessToken = accessToken;


    // Limpiar token de la URL
    window.history.replaceState(
        {},
        document.title,
        window.location.pathname
    );


    sessionStorage.removeItem(
        "oauth_state"
    );


    try {

        twitchUser =
            await getTwitchUser(
                twitchAccessToken
            );


        console.log(
            "Twitch user:",
            twitchUser
        );


        status.textContent =
            `Logged as ${twitchUser.display_name}`;


        // ====================================
        // CONECTAR AL CHAT DEL USUARIO
        // ====================================

        connectToChat(
            twitchUser.login
        );


    } catch (error) {

        console.error(
            "Error getting user:",
            error
        );

        status.textContent =
            "Error conectando con Twitch ❌";
    }
}


handleOAuthCallback();