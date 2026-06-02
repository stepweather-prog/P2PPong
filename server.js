const http = require('http');

const PORT = process.env.PORT || 10000;
const SESSION_TTL = 5 * 60 * 1000; // 5 минут жизни сессии
const MAX_SESSIONS = 10; // Максимум активных сессий
const CLEANUP_INTERVAL = 60 * 1000; // Очистка каждые 60 секунд

// Хранилище сессий
const sessions = {};

// Очистка просроченных сессий
function cleanupSessions() {
    const now = Date.now();
    const ids = Object.keys(sessions);
    
    // Удаляем просроченные
    for (const id of ids) {
        if (sessions[id].createdAt && (now - sessions[id].createdAt > SESSION_TTL)) {
            delete sessions[id];
        }
    }
    
    // Если всё ещё слишком много — удаляем самые старые
    const remaining = Object.keys(sessions);
    if (remaining.length > MAX_SESSIONS) {
        const sorted = remaining.sort((a, b) => sessions[a].createdAt - sessions[b].createdAt);
        const toDelete = sorted.slice(0, remaining.length - MAX_SESSIONS);
        for (const id of toDelete) {
            delete sessions[id];
        }
    }
}

// Продление жизни сессии
function touchSession(id) {
    if (sessions[id]) {
        sessions[id].createdAt = Date.now();
    }
}

// Создание или обновление сессии
function handleSession(req, res, body) {
    const { sessionId, role } = body;
    
    if (!sessionId || !role) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'sessionId and role required' }));
        return;
    }
    
    // Создаём или обновляем сессию
    if (!sessions[sessionId]) {
        sessions[sessionId] = {
            createdAt: Date.now(),
            creatorReady: false,
            receiverReady: false,
            offer: null,
            answer: null
        };
    } else {
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
    res.end(JSON.stringify({ status: matched ? 'matched' : 'waiting' }));
}

// Получение статуса сессии
function handleGetSession(req, res, sessionId) {
    if (!sessionId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'sessionId required' }));
        return;
    }
    
    if (!sessions[sessionId]) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'waiting' }));
        return;
    }
    
    touchSession(sessionId);
    const matched = sessions[sessionId].creatorReady && sessions[sessionId].receiverReady;
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: matched ? 'matched' : 'waiting' }));
}

// Отправка offer
function handleOffer(req, res, body) {
    const { sessionId, sdp } = body;
    
    if (!sessionId || !sdp) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'sessionId and sdp required' }));
        return;
    }
    
    if (!sessions[sessionId]) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'session not found' }));
        return;
    }
    
    touchSession(sessionId);
    sessions[sessionId].offer = sdp;
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
}

// Получение offer
function handleGetOffer(req, res, sessionId) {
    if (!sessionId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'sessionId required' }));
        return;
    }
    
    if (!sessions[sessionId]) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'waiting' }));
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

// Отправка answer
function handleAnswer(req, res, body) {
    const { sessionId, sdp } = body;
    
    if (!sessionId || !sdp) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'sessionId and sdp required' }));
        return;
    }
    
    if (!sessions[sessionId]) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'session not found' }));
        return;
    }
    
    touchSession(sessionId);
    sessions[sessionId].answer = sdp;
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
}

// Получение answer
function handleGetAnswer(req, res, sessionId) {
    if (!sessionId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'sessionId required' }));
        return;
    }
    
    if (!sessions[sessionId]) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'waiting' }));
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

// Создание сервера
const server = http.createServer((req, res) => {
    // CORS
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
    
    // Сбор тела запроса
    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
        if (body.length > 100000) { // Защита от больших запросов
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
        
        // Роутинг
        if (req.method === 'POST' && path === '/session') {
            handleSession(req, res, parsedBody);
        } else if (req.method === 'GET' && path === '/session') {
            handleGetSession(req, res, params.get('id'));
        } else if (req.method === 'POST' && path === '/offer') {
            handleOffer(req, res, parsedBody);
        } else if (req.method === 'GET' && path === '/offer') {
            handleGetOffer(req, res, params.get('id'));
        } else if (req.method === 'POST' && path === '/answer') {
            handleAnswer(req, res, parsedBody);
        } else if (req.method === 'GET' && path === '/answer') {
            handleGetAnswer(req, res, params.get('id'));
        } else if (req.method === 'GET' && path === '/ping') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok' }));
        } else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'not found' }));
        }
    });
});

// Запуск очистки
setInterval(cleanupSessions, CLEANUP_INTERVAL);

server.listen(PORT, () => {
    console.log(`Signal server running on port ${PORT}`);
});
