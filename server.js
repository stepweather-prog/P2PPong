const http = require('http');
const crypto = require('crypto');

const PORT = process.env.PORT || 10000;
const store = new Map();

const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    if (req.method === 'POST' && req.url === '/offer') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const { sdp } = JSON.parse(body);
                const id = crypto.randomUUID();
                store.set(id, { sdp, expires: Date.now() + 5 * 60 * 1000 });
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ id }));
            } catch(e) {
                res.writeHead(400);
                res.end('Invalid JSON');
            }
        });
        return;
    }

    if (req.method === 'GET' && req.url.startsWith('/offer?id=')) {
        const id = new URL(req.url, `http://localhost`).searchParams.get('id');
        const entry = store.get(id);
        if (!entry || entry.expires < Date.now()) {
            store.delete(id);
            res.writeHead(404);
            res.end('Not found');
            return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ sdp: entry.sdp }));
        return;
    }

    res.writeHead(404);
    res.end('Not found');
});

setInterval(() => {
    for (const [id, entry] of store) {
        if (entry.expires < Date.now()) store.delete(id);
    }
}, 2 * 60 * 1000);

server.listen(PORT, () => console.log(`Signal server running on port ${PORT}`));
