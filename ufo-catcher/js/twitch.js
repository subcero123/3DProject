const CLIENT_ID = "x8i6aj0bx5dwwdu6dbg4ix6bkq680r";
const REDIRECT_URI = "http://localhost:3000/ufo-catcher/";

const connectButton = document.getElementById("connectTwitch");
const status = document.getElementById("status");

let twitchAccessToken = null;
let twitchUser = null;
let chatSocket = null;

// Contadores
let counters = {
    left: 0,
    right: 0,
    up: 0,
    down: 0
};


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
        scope: "chat:read",
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

        console.log(
            "WebSocket closed"
        );
    };
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

    if (text === "left") {

        counters.left++;

        console.log(
            `[COUNTER] left: ${counters.left}`
        );

        document.getElementById(
            "leftCount"
        ).textContent = counters.left;

    }

    else if (text === "right") {

        counters.right++;

        console.log(
            `[COUNTER] right: ${counters.right}`
        );

        document.getElementById(
            "rightCount"
        ).textContent = counters.right;

    }

    else if (text === "up") {

        counters.up++;

        console.log(
            `[COUNTER] up: ${counters.up}`
        );

        document.getElementById(
            "upCount"
        ).textContent = counters.up;

    }

    else if (text === "down") {

        counters.down++;

        console.log(
            `[COUNTER] down: ${counters.down}`
        );

        document.getElementById(
            "downCount"
        ).textContent = counters.down;
    }
}


// ========================================
// 5. PROCESAR OAUTH
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