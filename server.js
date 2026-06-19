// server.js — P2PPong Render Server (Финал)
// WAL-режим (без блокировок при бэкапе), SQLite, кластеризация, CORS по доменам

const http = require('http');
const cluster = require('cluster');
const os = require('os');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const PORT = process.env.PORT || 10000;
const LOCKER_TTL = 300 * 1000;
const MAX_LOCKERS = 500;
const CLEANUP_INTERVAL = 30 * 1000;
const BACKUP_INTERVAL = 300 * 1000;
const DB_PATH = path.join(__dirname, 'lockers.db');

let requestCount = 0;
let db = null;
const rateLimit = new Map();

const ALLOWED_ORIGINS = [
    'https://stepweather-prog.github.io',
    'https://localhost',
    'https://127.0.0.1'
];

function initDB() {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('wal_autocheckpoint = 1000');
    db.pragma('busy_timeout = 5000');
    db.exec(`CREATE TABLE IF NOT EXISTS lockers (
        keyHash TEXT PRIMARY KEY,
        packet TEXT NOT NULL,
        createdAt INTEGER NOT NULL,
        taken INTEGER DEFAULT 0
    )`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_createdAt ON lockers(createdAt)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_taken ON lockers(taken)`);
}

function backupDB() {
    try {
        const timestamp = Date.now();
        const backupPath = DB_PATH + '.backup.' + timestamp;
        db.backup(backupPath);
        const backups = fs.readdirSync(__dirname)
            .filter(f => f.startsWith('lockers.db.backup.'))
            .map(f => ({ name: f, time: parseInt(f.split('.').pop()) }))
            .sort((a, b) => b.time - a.time);
        for (let i = 2; i < backups.length; i++) {
            fs.unlinkSync(path.join(__dirname, backups[i].name));
        }
        console.log('Backup created:', backupPath);
    } catch(e) {
        console.error('Backup error:', e.message);
    }
}

function restoreFromBackup() {
    const backups = fs.readdirSync(__dirname)
        .filter(f => f.startsWith('lockers.db.backup.'))
        .map(f => ({ name: f, time: parseInt(f.split('.').pop()) }))
        .sort((a, b) => b.time - a.time);
    if (backups.length > 0 && !fs.existsSync(DB_PATH)) {
        try {
            fs.copyFileSync(path.join(__dirname, backups[0].name), DB_PATH);
            console.log('Restored from backup:', backups[0].name);
        } catch(e) {
            console.error('Restore error:', e.message);
        }
    }
}

function getOrigin(headers) {
    const origin = headers['origin'] || headers['referer'] || '';
    try {
        const url = new URL(origin);
        return url.origin;
    } catch(e) {
        return origin;
    }
}

if (cluster.isMaster) {
    restoreFromBackup();
    initDB();
    const numCPUs = Math.min(os.cpus().length, 4);
    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }
    cluster.on('exit', (worker) => {
        console.log('Worker ' + worker.process.pid + ' died. Restarting...');
        cluster.fork();
    });
    setInterval(() => {
        db.exec(`DELETE FROM lockers WHERE createdAt < ?`, [Date.now() - LOCKER_TTL]);
        const count = db.prepare(`SELECT COUNT(*) as count FROM lockers`).get().count;
        if (count > MAX_LOCKERS) {
            const toDelete = db.prepare(`SELECT keyHash FROM lockers ORDER BY createdAt ASC LIMIT ?`).all(count - MAX_LOCKERS);
            const deleteStmt = db.prepare(`DELETE FROM lockers WHERE keyHash = ?`);
            for (const row of toDelete) {
                deleteStmt.run(row.keyHash);
            }
        }
    }, CLEANUP_INTERVAL);
    setInterval(() => {
        backupDB();
    }, BACKUP_INTERVAL);
    process.on('SIGTERM', () => { backupDB(); db.close(); for (const id in cluster.workers) cluster.workers[id].kill(); process.exit(0); });
    process.on('SIGINT', () => { backupDB(); db.close(); for (const id in cluster.workers) cluster.workers[id].kill(); process.exit(0); });
    process.on('uncaughtException', (err) => {
        console.error('Uncaught exception:', err.message);
        backupDB();
    });
    return;
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
        db.prepare(`INSERT OR REPLACE INTO lockers (keyHash, packet, createdAt, taken) VALUES (?, ?, ?, 0)`).run(keyHash, packet, Date.now());
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
        const entry = db.prepare(`SELECT * FROM lockers WHERE keyHash = ?`).get(key);
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
            db.prepare(`UPDATE lockers SET taken = 1 WHERE keyHash = ?`).run(key);
        }
        res.writeHead(200, { ...securityHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'found', packet: entry.packet }));
        return;
    }

    if (pathname === '/delete') {
        const key = params.get('key');
        if (key) {
            db.prepare(`DELETE FROM lockers WHERE keyHash = ?`).run(key);
            res.writeHead(200, { ...securityHeaders, 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'deleted' }));
            return;
        }
        res.writeHead(400, { ...securityHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'missing_key' }));
        return;
    }

    if (pathname === '/health' || pathname === '/ping') {
        const stats = db.prepare(`SELECT
            COUNT(*) as total,
            SUM(CASE WHEN keyHash LIKE 'waiting_%' THEN 1 ELSE 0 END) as waiting,
            SUM(CASE WHEN keyHash LIKE 'emoji_%' THEN 1 ELSE 0 END) as emoji,
            SUM(CASE WHEN keyHash LIKE 'ack_%' THEN 1 ELSE 0 END) as ack,
            SUM(CASE WHEN keyHash LIKE 'msg_%' THEN 1 ELSE 0 END) as msg,
            SUM(CASE WHEN keyHash LIKE 'webrtc_%' THEN 1 ELSE 0 END) as webrtc
        FROM lockers`).get();
        res.writeHead(200, { ...securityHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'ok',
            uptime: process.uptime(),
            requests: requestCount,
            pid: process.pid,
            memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
            lockers: stats.total,
            breakdown: { waiting: stats.waiting, emoji: stats.emoji, ack: stats.ack, msg: stats.msg, webrtc: stats.webrtc },
            timestamp: Date.now()
        }));
        return;
    }

    res.writeHead(404, { ...securityHeaders, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not_found' }));
});

server.listen(PORT, () => console.log('P2PPong Render Server worker ' + process.pid + ' on port ' + PORT));
