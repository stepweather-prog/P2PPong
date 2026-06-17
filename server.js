// server.js — P2PPong Render Server (Финальный)
// Персистентность через JSON-файл

const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 10000;
const SESSION_TTL = 30 * 60 * 1000;
const MAX_SESSIONS = 50;
const CLEANUP_INTERVAL = 30 * 1000;
const BEACON_TTL = 20 * 60 * 1000;
const LOCKER_TTL = 150 * 1000;
const MAX_MESSAGE_SIZE = 1024 * 10;
const PERSIST_FILE = path.join(__dirname, 'lockers.json');

let sessions = {};
let beacons = {};
let lockers = {};
const rateLimit = {};

// Загрузка персистентных данных
try {
    if (fs.existsSync(PERSIST_FILE)) {
        const raw = fs.readFileSync(PERSIST_FILE, 'utf8');
        const data = JSON.parse(raw);
        lockers = data.lockers || {};
        beacons = data.beacons || {};
        console.log('📦 Загружено ячеек:', Object.keys(lockers).length);
    }
} catch(e) {
    console.error('Ошибка загрузки:', e.message);
}

// Сохранение персистентных данных
function persistData() {
    try {
        const data = {
            lockers,
            beacons,
            savedAt: Date.now()
        };
        fs.writeFileSync(PERSIST_FILE + '.tmp', JSON.stringify(data));
        fs.renameSync(PERSIST_FILE + '.tmp', PERSIST_FILE);
    } catch(e) {
        console.error('Ошибка сохранения:', e.message);
    }
}

function generateSessionId() { return crypto.randomBytes(16).toString('hex'); }

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
    
    for (const id of Object.keys(beacons)) {
        if ((now - beacons[id].createdAt) > BEACON_TTL) {
            delete beacons[id];
            changed = true;
        }
    }
    for (const id of Object.keys(sessions)) {
        if ((now - sessions[id].createdAt) > SESSION_TTL) {
            delete sessions[id];
        }
    }
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
    
    if (changed) persistData();
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
    const path = url.pathname;
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

        // Слепая ячейка
        if (req.method === 'POST' && path === '/beacon') {
            const keyHash = p.keyHash;
            const packet = p.packet;
            if (keyHash && packet) {
                if (lockers[keyHash] && lockers[keyHash].taken) {
                    sendJson(res, 200, { status: 'taken' });
                    return;
                }
                lockers[keyHash] = { packet, createdAt: Date.now(), taken: false };
                persistData();
                sendJson(res, 200, { status: 'stored' });
                return;
            }

            // Старая логика
            const keyToStore = p.tempKeyHash || '';
            const publicId = p.publicId || '';
            if (!keyToStore) { sendJson(res, 400, { error: 'missing_tempKeyHash' }); return; }
            const sid = generateSessionId();
            beacons[sid] = { key: keyToStore, sessionId: sid, createdAt: Date.now(), matched: false, peerId: publicId };
            sessions[sid] = { createdAt: Date.now(), messages: [] };
            sendJson(res, 200, { sessionId: sid });
            return;
        }

        if (req.method === 'GET' && path === '/beacon') {
            const key = params.get('key');
            if (key) {
                const entry = lockers[key];
                if (!entry) { sendJson(res, 200, { status: 'empty' }); return; }
                if (entry.taken) { sendJson(res, 200, { status: 'taken' }); return; }
                entry.taken = true;
                persistData();
                sendJson(res, 200, { status: 'found', packet: entry.packet });
                return;
            }
            const id = params.get('id');
            const b = beacons[id];
            sendJson(res, 200, { matched: b ? b.matched : false, sessionId: id });
            return;
        }

        if (req.method === 'POST' && path === '/find') {
            const searchKey = p.tempKeyHash || '';
            const searchPeer = p.publicId || '';
            if (!searchKey) { sendJson(res, 400, { error: 'missing_tempKeyHash' }); return; }
            let found = null;
            for (const id of Object.keys(beacons)) {
                if (beacons[id].key === searchKey && !beacons[id].matched && beacons[id].peerId === searchPeer) {
                    beacons[id].matched = true;
                    found = beacons[id];
                    break;
                }
            }
            if (found) {
                if (!sessions[found.sessionId]) sessions[found.sessionId] = { createdAt: Date.now(), messages: [] };
                sendJson(res, 200, { sessionId: found.sessionId, status: 'matched' });
            } else {
                sendJson(res, 200, { status: 'waiting' });
            }
            return;
        }

        if (req.method === 'POST' && path === '/message') {
            if (!p.sessionId || !p.packet) { sendJson(res, 400, { error: 'missing_params' }); return; }
            if (!sessions[p.sessionId]) sessions[p.sessionId] = { createdAt: Date.now(), messages: [] };
            sessions[p.sessionId].createdAt = Date.now();
            sessions[p.sessionId].messages.push({ packet: p.packet, time: Date.now() });
            if (sessions[p.sessionId].messages.length > 50) {
                sessions[p.sessionId].messages = sessions[p.sessionId].messages.slice(-50);
            }
            sendJson(res, 200, { status: 'ok' });
            return;
        }

        if (req.method === 'GET' && path === '/message') {
            const id = params.get('id');
            const since = parseInt(params.get('since')) || 0;
            const s = sessions[id];
            if (!s) { sendJson(res, 200, { messages: [] }); return; }
            s.createdAt = Date.now();
            const msgs = s.messages.filter(m => m.time > since);
            sendJson(res, 200, { messages: msgs });
            return;
        }

        if (req.method === 'GET' && path === '/ping') {
            sendJson(res, 200, {
                status: 'ok',
                uptime: process.uptime(),
                lockers: Object.keys(lockers).length,
                beacons: Object.keys(beacons).length,
                sessions: Object.keys(sessions).length,
                timestamp: Date.now()
            });
            return;
        }

        sendJson(res, 404, { error: 'not_found' });
    });
});

setInterval(cleanupAll, CLEANUP_INTERVAL);
server.listen(PORT, () => console.log('🚀 P2PPong Render Server on port ' + PORT));
