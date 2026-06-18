// server.js — P2PPong Render Server (Финал)
// TTL = 300с, debounced persist, gracefull shutdown

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 10000;
const LOCKER_TTL = 300 * 1000;
const MAX_LOCKERS = 500;
const CLEANUP_INTERVAL = 30 * 1000;
const PERSIST_INTERVAL = 10000;
const PERSIST_FILE = path.join(__dirname, 'lockers.json');

let lockers = {};
let persistTimer = null;
let dirty = false;
const rateLimit = {};

try {
    if (fs.existsSync(PERSIST_FILE)) {
        const raw = fs.readFileSync(PERSIST_FILE, 'utf8');
        const data = JSON.parse(raw);
        lockers = data.lockers || {};
        console.log('Загружено ячеек:', Object.keys(lockers).length);
    }
} catch(e) {
    console.error('Ошибка загрузки:', e.message);
}

function persistData() {
    if (!dirty) return;
    dirty = false;
    try {
        const data = { lockers, savedAt: Date.now() };
        fs.writeFileSync(PERSIST_FILE + '.tmp', JSON.stringify(data));
        fs.renameSync(PERSIST_FILE + '.tmp', PERSIST_FILE);
    } catch(e) {}
}

function markDirty() {
    dirty = true;
    if (!persistTimer) {
        persistTimer = setTimeout(() => { persistData(); persistTimer = null; }, PERSIST_INTERVAL);
    }
}

function checkRateLimit(ip) {
    const now = Date.now();
    if (!rateLimit[ip]) rateLimit[ip] = [];
    rateLimit[ip] = rateLimit[ip].filter(t => now - t < 60000);
    if (rateLimit[ip].length >= 100) return false;
    rateLimit[ip].push(now);
    return true;
}

function cleanupAll() {
    const now = Date.now();
    let changed = false;
    for (const id of Object.keys(lockers)) {
        if ((now - lockers[id].createdAt) > LOCKER_TTL) {
            delete lockers[id];
            changed = true;
        }
    }
    for (const ip of Object.keys(rateLimit)) {
        rateLimit[ip] = rateLimit[ip].filter(t => now - t < 60000);
        if (rateLimit[ip].length === 0) delete rateLimit[ip];
    }
    if (changed) markDirty();
}

const securityHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY'
};

function applyHeaders(res) {
    Object.entries(securityHeaders).forEach(([key, value]) => {
        res.setHeader(key, value);
    });
}

function sendJson(res, status, data) {
    applyHeaders(res);
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}

const server = http.createServer((req, res) => {
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    if (!checkRateLimit(clientIp)) {
        sendJson(res, 429, { error: 'too_many_requests' });
        return;
    }

    if (req.method === 'OPTIONS') {
        applyHeaders(res);
        res.writeHead(204);
        res.end();
        return;
    }

    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;
    const params = url.searchParams;

    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
        if (body.length > 100000) {
            sendJson(res, 413, { error: 'payload_too_large' });
        }
    });

    req.on('end', () => {
        let p = {};
        if (body) {
            try { p = JSON.parse(body); }
            catch(e) { sendJson(res, 400, { error: 'invalid_json' }); return; }
        }

        if (req.method === 'POST' && pathname === '/beacon') {
            const keyHash = p.keyHash;
            const packet = p.packet;
            if (!keyHash || !packet) {
                sendJson(res, 400, { error: 'missing_params' });
                return;
            }
            if (keyHash.length > 128 || packet.length > 8192) {
                sendJson(res, 400, { error: 'too_large' });
                return;
            }
            const keys = Object.keys(lockers);
            if (keys.length >= MAX_LOCKERS) {
                const sorted = keys.sort((a, b) => lockers[a].createdAt - lockers[b].createdAt);
                const toDelete = sorted.slice(0, sorted.length - MAX_LOCKERS + 1);
                for (const key of toDelete) delete lockers[key];
            }
            lockers[keyHash] = { packet, createdAt: Date.now(), taken: false };
            markDirty();
            sendJson(res, 200, { status: 'stored' });
            return;
        }

        if (req.method === 'GET' && pathname === '/beacon') {
            const key = params.get('key');
            if (!key) { sendJson(res, 400, { error: 'missing_key' }); return; }
            const entry = lockers[key];
            if (!entry) { sendJson(res, 200, { status: 'empty' }); return; }
            if (entry.taken) { sendJson(res, 200, { status: 'taken' }); return; }
            if (key.startsWith('msg_') || key.startsWith('webrtc_')) {
                entry.taken = true;
                markDirty();
            }
            sendJson(res, 200, { status: 'found', packet: entry.packet });
            return;
        }

        if (pathname === '/delete') {
            const key = params.get('key');
            if (key) { delete lockers[key]; markDirty(); sendJson(res, 200, { status: 'deleted' }); return; }
            sendJson(res, 400, { error: 'missing_key' });
            return;
        }

        if (pathname === '/health' || pathname === '/ping') {
            let waiting = 0, emoji = 0, ack = 0, msg = 0, webrtc = 0;
            for (const key of Object.keys(lockers)) {
                if (key.startsWith('waiting_')) waiting++;
                else if (key.startsWith('emoji_')) emoji++;
                else if (key.startsWith('ack_')) ack++;
                else if (key.startsWith('msg_')) msg++;
                else if (key.startsWith('webrtc_')) webrtc++;
            }
            sendJson(res, 200, {
                status: 'ok', uptime: process.uptime(),
                lockers: Object.keys(lockers).length,
                breakdown: { waiting, emoji, ack, msg, webrtc },
                timestamp: Date.now()
            });
            return;
        }

        sendJson(res, 404, { error: 'not_found' });
    });
});

setInterval(cleanupAll, CLEANUP_INTERVAL);
setInterval(persistData, PERSIST_INTERVAL);

process.on('SIGTERM', () => { persistData(); process.exit(0); });
process.on('SIGINT', () => { persistData(); process.exit(0); });

server.listen(PORT, () => console.log('P2PPong Render Server on port ' + PORT));
