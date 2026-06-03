const http = require('http');
const crypto = require('crypto');

const PORT = process.env.PORT || 10000;
const SESSION_TTL = 30 * 60 * 1000;
const MAX_SESSIONS = 10;
const CLEANUP_INTERVAL = 60 * 1000;

const sessions = {};

function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

function generateSessionId() {
    return crypto.randomBytes(16).toString('hex');
}

function validateToken(sessionId, token, role) {
    if (!sessions[sessionId]) return false;
    if (role === 'creator') return sessions[sessionId].creatorToken === token;
    if (role === 'receiver') return sessions[sessionId].receiverToken === token;
    return false;
}

function cleanupSessions() {
    const now = Date.now();
    const ids = Object.keys(sessions);
    for (const id of ids) {
        if (sessions[id].createdAt && (now - sessions[id].createdAt > SESSION_TTL)) {
            delete sessions[id];
        }
    }
    const remaining = Object.keys(sessions);
    if (remaining.length > MAX_SESSIONS) {
        const sorted = remaining.sort((a, b) => sessions[a].createdAt - sessions[b].createdAt);
        const toDelete = sorted.slice(0, remaining.length - MAX_SESSIONS);
        for (const id of toDelete) {
            delete sessions[id];
        }
    }
}

function touchSession(id) {
    if (sessions[id]) sessions[id].createdAt = Date.now();
}

const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
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
        if (body.length > 100000) { res.writeHead(413); res.end(); }
    });
    
    req.on('end', () => {
        let p = {};
        if (body) { try { p = JSON.parse(body); } catch(e) { res.writeHead(400); res.end('{}'); return; } }
        
        if (req.method === 'POST' && path === '/session') {
            if (!p.creatorId) { res.writeHead(400); res.end('{}'); return; }
            const sid = generateSessionId();
            sessions[sid] = {
                createdAt: Date.now(),
                creatorToken: generateToken(),
                receiverToken: generateToken(),
                expectedCreator: p.creatorId,
                expectedReceiver: null,
                offer: null,
                answer: null,
                verified: false
            };
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ sessionId: sid, token: sessions[sid].creatorToken }));
        }
        else if (req.method === 'POST' && path === '/join') {
            if (!p.sessionId || !p.receiverId) { res.writeHead(400); res.end('{}'); return; }
            if (!sessions[p.sessionId]) { res.writeHead(404); res.end('{}'); return; }
            const s = sessions[p.sessionId];
            if (s.expectedReceiver && s.expectedReceiver !== p.receiverId) { res.writeHead(403); res.end('{}'); return; }
            s.expectedReceiver = p.receiverId;
            touchSession(p.sessionId);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ token: s.receiverToken }));
        }
        else if (req.method === 'POST' && path === '/verify') {
            if (!p.sessionId || !p.token || !p.receiverId) { res.writeHead(400); res.end('{}'); return; }
            if (!validateToken(p.sessionId, p.token, 'creator')) { res.writeHead(403); res.end('{}'); return; }
            const s = sessions[p.sessionId];
            if (s.expectedReceiver !== p.receiverId) { res.writeHead(403); res.end('{}'); return; }
            s.verified = true;
            touchSession(p.sessionId);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'verified' }));
        }
        else if (req.method === 'POST' && path === '/offer') {
            if (!p.sessionId || !p.token || !p.sdp) { res.writeHead(400); res.end('{}'); return; }
            if (!validateToken(p.sessionId, p.token, 'creator')) { res.writeHead(403); res.end('{}'); return; }
            if (!sessions[p.sessionId].verified) { res.writeHead(403); res.end('{}'); return; }
            touchSession(p.sessionId);
            sessions[p.sessionId].offer = p.sdp;
            res.writeHead(200); res.end('{}');
        }
        else if (req.method === 'GET' && path === '/offer') {
            const id = params.get('id'), t = params.get('token');
            if (!id || !t) { res.writeHead(400); res.end('{}'); return; }
            if (!validateToken(id, t, 'receiver')) { res.writeHead(403); res.end('{}'); return; }
            if (!sessions[id]) { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ status: 'waiting' })); return; }
            touchSession(id);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(sessions[id].offer ? { sdp: sessions[id].offer } : { status: 'waiting' }));
        }
        else if (req.method === 'POST' && path === '/answer') {
            if (!p.sessionId || !p.token || !p.sdp) { res.writeHead(400); res.end('{}'); return; }
            if (!validateToken(p.sessionId, p.token, 'receiver')) { res.writeHead(403); res.end('{}'); return; }
            if (!sessions[p.sessionId]) { res.writeHead(404); res.end('{}'); return; }
            touchSession(p.sessionId);
            sessions[p.sessionId].answer = p.sdp;
            res.writeHead(200); res.end('{}');
        }
        else if (req.method === 'GET' && path === '/answer') {
            const id = params.get('id'), t = params.get('token');
            if (!id || !t) { res.writeHead(400); res.end('{}'); return; }
            if (!validateToken(id, t, 'creator')) { res.writeHead(403); res.end('{}'); return; }
            if (!sessions[id]) { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ status: 'waiting' })); return; }
            touchSession(id);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(sessions[id].answer ? { sdp: sessions[id].answer } : { status: 'waiting' }));
        }
        else if (req.method === 'GET' && path === '/ping') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok' }));
        }
        else { res.writeHead(404); res.end('{}'); }
    });
});

setInterval(cleanupSessions, CLEANUP_INTERVAL);

server.listen(PORT, () => {
    console.log(`Signal server running on port ${PORT}`);
});
