// ==================== SERVER.JS — RENDER СЕРВЕР ====================
const http = require('http');
const crypto = require('crypto');

const PORT = process.env.PORT || 10000;
const SESSION_TTL = 30 * 60 * 1000;
const MAX_SESSIONS = 50;
const CLEANUP_INTERVAL = 30 * 1000;
const BEACON_TTL = 20 * 60 * 1000;
const LOCKER_TTL = 150 * 1000;

const sessions = {};
const beacons = {};
const lockers = {};

function generateSessionId() { return crypto.randomBytes(16).toString('hex'); }

function cleanupAll() {
    const now = Date.now();
    for (const id of Object.keys(beacons)) {
        if ((now - beacons[id].createdAt) > BEACON_TTL) delete beacons[id];
    }
    for (const id of Object.keys(sessions)) {
        if ((now - sessions[id].createdAt) > SESSION_TTL) delete sessions[id];
    }
    for (const id of Object.keys(lockers)) {
        if ((now - lockers[id].createdAt) > LOCKER_TTL) delete lockers[id];
    }
}

const securityHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Public-Key-Pins': 'pin-sha256="X3pGTSOuJeEVw989IJ/cEtXUEmy52zs1TZQrU06KUKg="; max-age=2592000; includeSubDomains',
    'Expect-CT': 'max-age=86400, enforce',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY'
};

const server = http.createServer((req, res) => {
    // Применяем security headers ко всем ответам
    Object.entries(securityHeaders).forEach(([key, value]) => {
        if (key !== 'Access-Control-Allow-Methods' && key !== 'Access-Control-Allow-Headers' && key !== 'Access-Control-Max-Age') {
            res.setHeader(key, value);
        }
    });
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = url.pathname;
    const params = url.searchParams;

    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
        if (body.length > 100000) { res.writeHead(413); res.end(JSON.stringify({ error: 'payload_too_large' })); }
    });

    req.on('end', () => {
        let p = {};
        if (body) { try { p = JSON.parse(body); } catch(e) { res.writeHead(400); res.end(JSON.stringify({ error: 'invalid_json' })); return; } }

        // ==================== СЛЕПАЯ ЯЧЕЙКА (как Cloudflare Worker) ====================
        if (req.method === 'POST' && path === '/beacon') {
            const keyHash = p.keyHash;
            const packet = p.packet;
            if (keyHash && packet) {
                lockers[keyHash] = { packet, createdAt: Date.now(), taken: false };
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'stored' }));
                return;
            }

            // Старая логика маяков (совместимость)
            const keyToStore = p.tempKeyHash || '';
            const publicId = p.publicId || '';
            if (!keyToStore) { res.writeHead(400); res.end(JSON.stringify({ error: 'missing_tempKeyHash' })); return; }

            const sid = generateSessionId();
            beacons[sid] = { key: keyToStore, sessionId: sid, createdAt: Date.now(), matched: false, peerId: publicId };
            sessions[sid] = { createdAt: Date.now(), messages: [] };
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ sessionId: sid }));
            return;
        }

        if (req.method === 'GET' && path === '/beacon') {
            const key = params.get('key');
            if (key) {
                const entry = lockers[key];
                if (!entry) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ status: 'empty' }));
                    return;
                }
                if (entry.taken) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ status: 'taken' }));
                    return;
                }
                entry.taken = true;
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'found', packet: entry.packet }));
                return;
            }

            // Старая логика
            const id = params.get('id');
            const b = beacons[id];
            const matched = b ? b.matched : false;
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ matched, sessionId: id }));
            return;
        }

        // ==================== СТАРЫЕ ЭНДПОИНТЫ (совместимость) ====================
        if (req.method === 'POST' && path === '/find') {
            const searchKey = p.tempKeyHash || '';
            const searchPeer = p.publicId || '';
            if (!searchKey) { res.writeHead(400); res.end(JSON.stringify({ error: 'missing_tempKeyHash' })); return; }
            let found = null;
            for (const id of Object.keys(beacons)) {
                if (beacons[id].key === searchKey && !beacons[id].matched && beacons[id].peerId === searchPeer) {
                    beacons[id].matched = true;
                    found = beacons[id];
                    break;
                }
            }
            if (found) {
                if (!sessions[found.sessionId]) { sessions[found.sessionId] = { createdAt: Date.now(), messages: [] }; }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ sessionId: found.sessionId, status: 'matched' }));
            } else {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'waiting' }));
            }
            return;
        }

        if (req.method === 'POST' && path === '/message') {
            if (!p.sessionId || !p.packet) { res.writeHead(400); res.end(JSON.stringify({ error: 'missing_params' })); return; }
            if (!sessions[p.sessionId]) { sessions[p.sessionId] = { createdAt: Date.now(), messages: [] }; }
            sessions[p.sessionId].createdAt = Date.now();
            sessions[p.sessionId].messages.push({ packet: p.packet, time: Date.now() });
            if (sessions[p.sessionId].messages.length > 50) { sessions[p.sessionId].messages = sessions[p.sessionId].messages.slice(-50); }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok' }));
            return;
        }

        if (req.method === 'GET' && path === '/message') {
            const id = params.get('id'), since = parseInt(params.get('since')) || 0;
            const s = sessions[id];
            if (!s) { res.writeHead(200); res.end(JSON.stringify({ messages: [] })); return; }
            s.createdAt = Date.now();
            const msgs = s.messages.filter(m => m.time > since);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ messages: msgs }));
            return;
        }

        if (req.method === 'GET' && path === '/ping') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok', uptime: process.uptime(), lockers: Object.keys(lockers).length, timestamp: Date.now() }));
            return;
        }

        res.writeHead(404);
        res.end(JSON.stringify({ error: 'not_found' }));
    });
});

setInterval(cleanupAll, CLEANUP_INTERVAL);
server.listen(PORT, () => console.log('P2PPong Render Server on port ' + PORT));
