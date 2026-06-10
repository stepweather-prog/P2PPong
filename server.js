const http = require('http');
const crypto = require('crypto');

const PORT = process.env.PORT || 10000;
const SESSION_TTL = 30 * 60 * 1000; // 30 минут для активных сессий
const MAX_SESSIONS = 10;
const CLEANUP_INTERVAL = 30 * 1000; // очистка каждые 30 секунд
const BEACON_WAITING_TTL = 60 * 1000; // маяк ждёт 60 секунд
const BEACON_FOUND_TTL = 30 * 1000; // после found ждём подтверждения 30 секунд

const sessions = {};
const beacons = {}; // отдельное хранилище для маяков

function generateToken() { return crypto.randomBytes(32).toString('hex'); }
function generateSessionId() { return crypto.randomBytes(16).toString('hex'); }
function generateBeaconId() { return crypto.randomBytes(12).toString('hex'); }

function cleanupAll() {
    const now = Date.now();
    
    // Очистка маяков
    for (const id of Object.keys(beacons)) {
        const b = beacons[id];
        if (b.status === 'waiting' && (now - b.createdAt) > BEACON_WAITING_TTL) {
            delete beacons[id];
        } else if (b.status === 'found' && (now - b.foundAt) > BEACON_FOUND_TTL) {
            delete beacons[id];
        }
    }
    
    // Очистка сессий
    for (const id of Object.keys(sessions)) {
        if (sessions[id].createdAt && (now - sessions[id].createdAt) > SESSION_TTL) {
            delete sessions[id];
        }
    }
    
    // Ограничение по количеству
    const remaining = Object.keys(sessions);
    if (remaining.length > MAX_SESSIONS) {
        const sorted = remaining.sort((a,b) => sessions[a].createdAt - sessions[b].createdAt);
        for (const id of sorted.slice(0, remaining.length - MAX_SESSIONS)) {
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
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    
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
            res.end(JSON.stringify({ error: 'payload_too_large' })); 
        } 
    });
    
    req.on('end', () => {
        let p = {};
        if (body) { 
            try { 
                p = JSON.parse(body); 
            } catch(e) { 
                res.writeHead(400); 
                res.end(JSON.stringify({ error: 'invalid_json' })); 
                return;
            } 
        }
        
        // ============ МАЯК (BEACON) ============
        if (req.method === 'POST' && path === '/beacon') {
            if (!p.tempKey) { 
                res.writeHead(400); 
                res.end(JSON.stringify({ error: 'missing_tempKey' })); 
                return; 
            }
            const bid = generateBeaconId();
            beacons[bid] = {
                beaconId: bid,
                tempKey: p.tempKey,
                status: 'waiting', // waiting → found → confirmed (потом удаляется)
                createdAt: Date.now(),
                foundAt: null,
                creatorConfirmed: false,
                finderConfirmed: false,
                sessionId: null // будет присвоен при подтверждении
            };
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ beaconId: bid, sessionId: bid })); // sessionId для обратной совместимости
        }
        
        // ============ ПОИСК МАЯКА ============
        else if (req.method === 'POST' && path === '/find') {
            if (!p.tempKey) { 
                res.writeHead(400); 
                res.end(JSON.stringify({ error: 'missing_tempKey' })); 
                return; 
            }
            let found = null;
            for (const id of Object.keys(beacons)) {
                if (beacons[id].tempKey === p.tempKey && beacons[id].status === 'waiting') {
                    beacons[id].status = 'found';
                    beacons[id].foundAt = Date.now();
                    found = beacons[id];
                    break;
                }
            }
            if (found) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ sessionId: found.beaconId, status: 'matched' }));
            } else {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'waiting' }));
            }
        }
        
        // ============ ПРОВЕРКА СТАТУСА МАЯКА ============
        else if (req.method === 'GET' && path === '/beacon') {
            const id = params.get('id');
            if (!id || !beacons[id]) { 
                res.writeHead(200, { 'Content-Type': 'application/json' }); 
                res.end(JSON.stringify({ matched: false, confirmed: false })); 
                return; 
            }
            const b = beacons[id];
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                matched: b.status === 'found' || b.status === 'confirmed',
                confirmed: b.creatorConfirmed && b.finderConfirmed,
                status: b.status
            }));
        }
        
        // ============ ПОДТВЕРЖДЕНИЕ (ДВУХСТОРОННЕЕ) ============
        else if (req.method === 'POST' && path === '/confirm') {
            if (!p.sessionId || !p.role) { 
                res.writeHead(400); 
                res.end(JSON.stringify({ error: 'missing_params' })); 
                return; 
            }
            const b = beacons[p.sessionId];
            if (!b) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'beacon_not_found' }));
                return;
            }
            
            if (p.role === 'creator') b.creatorConfirmed = true;
            if (p.role === 'finder') b.finderConfirmed = true;
            
            if (b.creatorConfirmed && b.finderConfirmed) {
                // Обе стороны подтвердили — создаём сессию и удаляем маяк
                const sid = b.beaconId;
                sessions[sid] = {
                    createdAt: Date.now(),
                    messages: [],
                    matched: true
                };
                b.status = 'confirmed';
                b.sessionId = sid;
                delete beacons[p.sessionId]; // удаляем маяк
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'confirmed_and_deleted', sessionId: sid }));
            } else {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'partial_confirm' }));
            }
        }
        
        // ============ ОТМЕНА МАЯКА ============
        else if (req.method === 'POST' && path === '/cancel-beacon') {
            if (!p.tempKey) { 
                res.writeHead(400); 
                res.end(JSON.stringify({ error: 'missing_tempKey' })); 
                return; 
            }
            for (const id of Object.keys(beacons)) {
                if (beacons[id].tempKey === p.tempKey) {
                    delete beacons[id];
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ status: 'cancelled' }));
                    return;
                }
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'not_found' }));
        }
        
        // ============ ОТПРАВКА СООБЩЕНИЯ ============
        else if (req.method === 'POST' && path === '/message') {
            if (!p.sessionId || !p.packet) { 
                res.writeHead(400); 
                res.end(JSON.stringify({ error: 'missing_params' })); 
                return; 
            }
            if (!sessions[p.sessionId]) { 
                res.writeHead(404); 
                res.end(JSON.stringify({ error: 'session_not_found' })); 
                return; 
            }
            touchSession(p.sessionId);
            sessions[p.sessionId].messages.push({ packet: p.packet, time: Date.now() });
            // Храним не больше 100 сообщений на сессию
            if (sessions[p.sessionId].messages.length > 100) {
                sessions[p.sessionId].messages = sessions[p.sessionId].messages.slice(-50);
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok' }));
        }
        
        // ============ ПОЛУЧЕНИЕ СООБЩЕНИЙ ============
        else if (req.method === 'GET' && path === '/message') {
            const id = params.get('id'), since = parseInt(params.get('since')) || 0;
            if (!id || !sessions[id]) { 
                res.writeHead(200, { 'Content-Type': 'application/json' }); 
                res.end(JSON.stringify({ messages: [] })); 
                return; 
            }
            touchSession(id);
            const msgs = sessions[id].messages.filter(m => m.time > since);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ messages: msgs }));
        }
        
        // ============ PING ============
        else if (req.method === 'GET' && path === '/ping') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }));
        }
        
        // ============ 404 ============
        else { 
            res.writeHead(404, { 'Content-Type': 'application/json' }); 
            res.end(JSON.stringify({ error: 'not_found' })); 
        }
    });
});

setInterval(cleanupAll, CLEANUP_INTERVAL);
server.listen(PORT, () => console.log('RobinHood Message Server on port ' + PORT));
