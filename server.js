const http = require('http');
const crypto = require('crypto');

const PORT = process.env.PORT || 10000;
const SESSION_TTL = 5 * 60 * 1000;
const MAX_SESSIONS = 10;
const CLEANUP_INTERVAL = 60 * 1000;

const sessions = {};

// Генерация токена
function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

// Проверка токена
function validateToken(sessionId, token) {
    if (!sessions[sessionId]) return false;
    return sessions[sessionId].token === token;
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
    if (sessions[id]) {
        sessions[id].createdAt = Date.now();
    }
}

// POST /session — создание/принятие сессии
function handleSession(req, res, body) {
    const { sessionId, role } = body;
    
    if (!sessionId || !role) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'sessionId and role required' }));
        return;
    }
    
    let token;
    
    if (!sessions[sessionId]) {
        token = generateToken();
        sessions[sessionId] = {
            createdAt: Date.now(),
            token: token,
            creatorReady: false,
            receiverReady: false,
            offer: null,
            answer: null
        };
    } else {
        token = sessions[sessionId].token;
        touchSession(sessionId);
    }
    
    if (role === 'creator') {
        sessions[sessionId].creatorReady = true;
    } else if (role === 'receiver') {
        sessions[sessionId].receiverReady = true;
    }
    
    const session = sessions[sessionId];
    const matched = session.creatorReady && session.receiverReady;
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: matched ? 'matched' : 'waiting', token: token }));
}

// GET /session?id=...&token=... — проверка статуса
function handleGetSession(req, res, sessionId, token) {
    if (!sessionId || !token) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'sessionId and token required' }));
        return;
    }
    
    if (!sessions[sessionId] || !validateToken(sessionId, token)) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'forbidden' }));
        return;
    }
    
    touchSession(sessionId);
    const matched = sessions[sessionId].creatorReady && sessions[sessionId].receiverReady;
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: matched ? 'matched' : 'waiting' }));
}

// POST /offer — отправка offer
function handleOffer(req, res, body) {
    const { sessionId, sdp, token } = body;
    
    if (!sessionId || !sdp || !token) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'sessionId, sdp, and token required' }));
        return;
    }
    
    if (!validateToken(sessionId, token)) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'forbidden' }));
        return;
    }
    
    touchSession(sessionId);
    sessions[sessionId].offer = sdp;
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
}

// GET /offer?id=...&token=... — получение offer
function handleGetOffer(req, res, sessionId, token) {
    if (!sessionId || !token) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'sessionId and token required' }));
        return;
    }
    
    if (!validateToken(sessionId, token)) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'forbidden' }));
        return;
    }
    
    touchSession(sessionId);
    
    if (sessions[sessionId].offer) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ sdp: sessions[sessionId].offer }));
    } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'waiting' }));
    }
}

// POST /answer — отправка answer
function handleAnswer(req, res, body) {
    const { sessionId, sdp, token } = body;
    
    if (!sessionId || !sdp || !token) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'sessionId, sdp, and token required' }));
        return;
    }
    
    if (!validateToken(sessionId, token)) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'forbidden' }));
        return;
    }
    
    touchSession(sessionId);
    sessions[sessionId].answer = sdp;
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
}

// GET /answer?id=...&token=... — получение answer
function handleGetAnswer(req, res, sessionId, token) {
    if (!sessionId || !token) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'sessionId and token required' }));
        return;
    }
    
    if (!validateToken(sessionId, token)) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'forbidden' }));
        return;
    }
    
    touchSession(sessionId);
    
    if (sessions[sessionId].answer) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ sdp: sessions[sessionId].answer }));
    } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'waiting' }));
    }
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
        if (body.length > 100000) {
            res.writeHead(413);
            res.end();
        }
    });
    
    req.on('end', () => {
        let parsedBody = {};
        if (body) {
            try {
                parsedBody = JSON.parse(body);
            } catch(e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'invalid JSON' }));
                return;
            }
        }
        
        if (req.method === 'POST' && path === '/session') {
            handleSession(req, res, parsedBody);
        } else if (req.method === 'GET' && path === '/session') {
            handleGetSession(req, res, params.get('id'), params.get('token'));
        } else if (req.method === 'POST' && path === '/offer') {
            handleOffer(req, res, parsedBody);
        } else if (req.method === 'GET' && path === '/offer') {
            handleGetOffer(req, res, params.get('id'), params.get('token'));
        } else if (req.method === 'POST' && path === '/answer') {
            handleAnswer(req, res, parsedBody);
        } else if (req.method === 'GET' && path === '/answer') {
            handleGetAnswer(req, res, params.get('id'), params.get('token'));
        } else if (req.method === 'GET' && path === '/ping') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok' }));
        } else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'not found' }));
        }
    });
});

setInterval(cleanupSessions, CLEANUP_INTERVAL);

server.listen(PORT, () => {
    console.log(`Signal server running on port ${PORT}`);
});
