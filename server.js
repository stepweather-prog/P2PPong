const http = require('http');
const crypto = require('crypto');

const PORT = process.env.PORT || 10000;
const SESSION_TTL = 30 * 60 * 1000;
const MAX_SESSIONS = 10;
const CLEANUP_INTERVAL = 60 * 1000;

const sessions = {};

function generateToken() { return crypto.randomBytes(32).toString('hex'); }
function generateSessionId() { return crypto.randomBytes(16).toString('hex'); }

function cleanupSessions() {
    const now = Date.now();
    const ids = Object.keys(sessions);
    for (const id of ids) {
        if (sessions[id].createdAt && (now - sessions[id].createdAt > SESSION_TTL)) delete sessions[id];
    }
    const remaining = Object.keys(sessions);
    if (remaining.length > MAX_SESSIONS) {
        const sorted = remaining.sort((a,b) => sessions[a].createdAt - sessions[b].createdAt);
        for (const id of sorted.slice(0, remaining.length - MAX_SESSIONS)) delete sessions[id];
    }
}

function touchSession(id) { if (sessions[id]) sessions[id].createdAt = Date.now(); }

const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    
    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = url.pathname;
    const params = url.searchParams;
    
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); if (body.length > 100000) { res.writeHead(413); res.end(); } });
    
    req.on('end', () => {
        let p = {};
        if (body) { try { p = JSON.parse(body); } catch(e) { res.writeHead(400); res.end('{}'); return; } }
        
        if (req.method === 'POST' && path === '/beacon') {
            if (!p.tempKey) { res.writeHead(400); res.end('{}'); return; }
            const sid = generateSessionId();
            sessions[sid] = { createdAt: Date.now(), tempKey: p.tempKey, messages: [], matched: false };
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ sessionId: sid }));
        }
        else if (req.method === 'POST' && path === '/find') {
            if (!p.tempKey) { res.writeHead(400); res.end('{}'); return; }
            let found = null;
            for (const id of Object.keys(sessions)) {
                if (sessions[id].tempKey === p.tempKey && !sessions[id].matched) {
                    sessions[id].matched = true;
                    found = id;
                    touchSession(id);
                    break;
                }
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(found ? { sessionId: found, status: 'matched' } : { status: 'waiting' }));
        }
        else if (req.method === 'GET' && path === '/beacon') {
            const id = params.get('id');
            if (!id || !sessions[id]) { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ matched: false })); return; }
            touchSession(id);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ matched: sessions[id].matched }));
        }
        else if (req.method === 'POST' && path === '/message') {
            if (!p.sessionId || !p.packet) { res.writeHead(400); res.end('{}'); return; }
            if (!sessions[p.sessionId]) { res.writeHead(404); res.end('{}'); return; }
            touchSession(p.sessionId);
            sessions[p.sessionId].messages.push({ packet: p.packet, time: Date.now() });
            res.writeHead(200); res.end('{}');
        }
        else if (req.method === 'GET' && path === '/message') {
            const id = params.get('id'), since = parseInt(params.get('since')) || 0;
            if (!id || !sessions[id]) { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ messages: [] })); return; }
            touchSession(id);
            const msgs = sessions[id].messages.filter(m => m.time > since);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ messages: msgs }));
        }
        else if (req.method === 'GET' && path === '/ping') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok' }));
        }
        else { res.writeHead(404); res.end('{}'); }
    });
});

setInterval(cleanupSessions, CLEANUP_INTERVAL);
server.listen(PORT, () => console.log('Message server on ' + PORT));
