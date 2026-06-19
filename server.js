// server.js — P2PPong Render Server (Финал)
// In-memory Map, CORS, rate limiting, кластеризация опциональна

const http = require('http');
const cluster = require('cluster');
const os = require('os');

const PORT = process.env.PORT || 10000;
const LOCKER_TTL = 300 * 1000;
const MAX_LOCKERS = 500;
const CLEANUP_INTERVAL = 30 * 1000;

let requestCount = 0;
const lockers = new Map();
const rateLimit = new Map();

const ALLOWED_ORIGINS = [
    'https://stepweather-prog.github.io',
    'https://localhost',
    'https://127.0.0.1'
];

function getOrigin(headers) {
    const origin = headers['origin'] || headers['referer'] || '';
    try {
        const url = new URL(origin);
        return url.origin;
    } catch(e) {
        return origin;
    }
}

function cleanup() {
    const now = Date.now();
    const toDelete = [];
    for (const [key, entry] of lockers) {
        if (now - entry.createdAt > LOCKER_TTL) {
            toDelete.push(key);
        }
    }
    toDelete.forEach(key => lockers.delete(key));

    if (lockers.size > MAX_LOCKERS) {
        const sorted = [...lockers.entries()]
            .sort((a, b) => a[1].createdAt - b[1].createdAt);
        const excess = sorted.length - MAX_LOCKERS;
        for (let i = 0; i < excess; i++) {
            lockers.delete(sorted[i][0]);
        }
    }
}

function checkRateLimit(ip) {
    const now = Date.now();
    if (!rateLimit.has(ip)) {
        rateLimit.set(ip, []);
    }
    const timestamps = rateLimit.get(ip).filter(t => now - t < 60000);
    rateLimit.set(ip, timestamps);
    if (timestamps.length >= 100) return false;
    timestamps.push(now);
    return true;
}

function getRequestBody(req) {
    return new Promise((resolve) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
            if (body.length > 100000) {
                body = '';
                req.destroy();
                resolve(null);
            }
        });
        req.on('end', () => {
            resolve(body);
        });
    });
}

// Одиночный процесс — без кластеризации на Render
if (cluster.isMaster && process.env.RENDER_SERVICE_ID) {
    // На Render просто запускаем один процесс, без форков
    startServer();
} else if (cluster.isMaster) {
    // Вне Render — форкаем на все ядра
    const numCPUs = Math.min(os.cpus().length, 4);
    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }
    cluster.on('exit', (worker) => {
        console.log('Worker ' + worker.process.pid + ' died. Restarting...');
        cluster.fork();
    });
    setInterval(cleanup, CLEANUP_INTERVAL);
    process.on('SIGTERM', () => { for (const id in cluster.workers) cluster.workers[id].kill(); process.exit(0); });
    process.on('SIGINT', () => { for (const id in cluster.workers) cluster.workers[id].kill(); process.exit(0); });
} else {
    startServer();
}

function startServer() {
    const server = http.createServer(async (req, res) => {
        requestCount++;
        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
        const origin = getOrigin(req.headers);
        const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

        const securityHeaders = {
            'Access-Control-Allow-Origin': allowedOrigin,
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '86400',
            'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
            'Vary': 'Origin'
        };

        if (!checkRateLimit(clientIp)) {
            res.writeHead(429, { ...securityHeaders, 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'too_many_requests' }));
            return;
        }

        if (req.method === 'OPTIONS') {
            res.writeHead(204, securityHeaders);
            res.end();
            return;
        }

        const url = new URL(req.url, `http://${req.headers.host}`);
        const pathname = url.pathname;
        const params = url.searchParams;

        const body = await getRequestBody(req);
        if (body === null) {
            res.writeHead(413, { ...securityHeaders, 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'payload_too_large' }));
            return;
        }

        let p = {};
        if (body) {
            try { p = JSON.parse(body); }
            catch(e) {
                res.writeHead(400, { ...securityHeaders, 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'invalid_json' }));
                return;
            }
        }

        if (req.method === 'POST' && pathname === '/beacon') {
            const keyHash = p.keyHash;
            const packet = p.packet;
            if (!keyHash || !packet) {
                res.writeHead(400, { ...securityHeaders, 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'missing_params' }));
                return;
            }
            if (keyHash.length > 128 || packet.length > 8192) {
                res.writeHead(400, { ...securityHeaders, 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'too_large' }));
                return;
            }
            lockers.set(keyHash, {
                packet,
                createdAt: Date.now(),
                taken: false
            });
            res.writeHead(200, { ...securityHeaders, 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'stored' }));
            return;
        }

        if (req.method === 'GET' && pathname === '/beacon') {
            const key = params.get('key');
            if (!key) {
                res.writeHead(400, { ...securityHeaders, 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'missing_key' }));
                return;
            }
            const entry = lockers.get(key);
            if (!entry) {
                res.writeHead(200, { ...securityHeaders, 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'empty' }));
                return;
            }
            if (entry.taken) {
                res.writeHead(200, { ...securityHeaders, 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'taken' }));
                return;
            }
            if (key.startsWith('msg_') || key.startsWith('webrtc_')) {
                entry.taken = true;
            }
            res.writeHead(200, { ...securityHeaders, 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'found', packet: entry.packet }));
            return;
        }

        if (pathname === '/delete') {
            const key = params.get('key');
            if (key) {
                lockers.delete(key);
                res.writeHead(200, { ...securityHeaders, 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'deleted' }));
                return;
            }
            res.writeHead(400, { ...securityHeaders, 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'missing_key' }));
            return;
        }

        if (pathname === '/health' || pathname === '/ping') {
            let waiting = 0, emoji = 0, ack = 0, msg = 0, webrtc = 0;
            for (const [key] of lockers) {
                if (key.startsWith('waiting_')) waiting++;
                else if (key.startsWith('emoji_')) emoji++;
                else if (key.startsWith('ack_')) ack++;
                else if (key.startsWith('msg_')) msg++;
                else if (key.startsWith('webrtc_')) webrtc++;
            }
            res.writeHead(200, { ...securityHeaders, 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                status: 'ok',
                uptime: process.uptime(),
                requests: requestCount,
                pid: process.pid,
                memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
                lockers: lockers.size,
                breakdown: { waiting, emoji, ack, msg, webrtc },
                timestamp: Date.now()
            }));
            return;
        }

        res.writeHead(404, { ...securityHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'not_found' }));
    });

    server.listen(PORT, () => console.log('P2PPong Render Server worker ' + process.pid + ' on port ' + PORT));
}
