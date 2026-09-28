/* ===== PLAYER POINTS DATABASE ===== */
/* Tiny "database" kept in localStorage: maps twitch usernames to points.
   If localStorage is unavailable (private mode, blocked storage) the
   points are kept in memory only, so the game keeps working. */

const SCORES_KEY = 'ufo_catcher_scores';

/* In-memory copy, always the source of truth while the page is open */
let scoresCache = loadScores();


/* ===== LOAD / SAVE ===== */
function loadScores() {
    try {
        const raw = localStorage.getItem(SCORES_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        return (parsed && typeof parsed === 'object') ? parsed : {};
    } catch (err) {
        console.warn('[SCORES] Could not read storage, using memory only:', err);
        return {};
    }
}

function saveScores() {
    try {
        localStorage.setItem(SCORES_KEY, JSON.stringify(scoresCache));
    } catch (err) {
        console.warn('[SCORES] Could not save points:', err);
    }
}

function normalizeUsername(username) {
    return String(username || '').trim().toLowerCase();
}


/* ===== READ POINTS ===== */
function getPoints(username) {
    const name = normalizeUsername(username);
    if (!name) return 0;
    return scoresCache[name] || 0;
}

function getLeaderboard() {
    return Object.entries(scoresCache)
        .map(([username, points]) => ({ username, points }))
        .sort((a, b) => b.points - a.points);
}


/* ===== ADD POINTS (rewards) ===== */
function addPoints(username, points) {
    const name = normalizeUsername(username);
    if (!name || !points) return getPoints(name);

    scoresCache[name] = (scoresCache[name] || 0) + points;
    saveScores();

    console.log(`[SCORES] ${name} +${points} = ${scoresCache[name]}`);

    return scoresCache[name];
}


/* ===== SPEND POINTS (paid commands) ===== */
/* Returns { ok, total, missing } with the balance after the attempt */
function spendPoints(username, cost) {
    const name = normalizeUsername(username);
    const total = getPoints(name);

    if (!name || total < cost) {
        return {
            ok: false,
            total,
            missing: Math.max(0, cost - total),
        };
    }

    scoresCache[name] = total - cost;
    saveScores();

    console.log(`[SCORES] ${name} -${cost} = ${scoresCache[name]}`);

    return {
        ok: true,
        total: scoresCache[name],
        missing: 0,
    };
}
