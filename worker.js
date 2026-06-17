// worker.js — P2PPong Blind Locker (Cloudflare Durable Objects)
// Сервер не знает: кто положил, кто забрал, что внутри.
// Только номер ячейки и зашифрованный пакет.

var HiveRoom = class {
    constructor(state, env) {
        this.lockers = new Map(); // keyHash → { packet, createdAt, taken }
    }

    async fetch(request) {
        const url = new URL(request.url);

        if (request.method === 'OPTIONS') {
            return new Response(null, {
                status: 204,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type',
                    'Access-Control-Max-Age': '86400'
                }
            });
        }

        // ==================== ПОЛОЖИТЬ В ЯЧЕЙКУ ====================
        if (request.method === 'POST' && url.pathname === '/beacon') {
            let body;
            try { body = await request.json(); } catch(e) {
                return new Response(JSON.stringify({ error: 'invalid_json' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
                });
            }

            const { keyHash, packet } = body;
            if (!keyHash || !packet) {
                return new Response(JSON.stringify({ error: 'missing_params' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
                });
            }

            this.lockers.set(keyHash, {
                packet,
                createdAt: Date.now(),
                taken: false
            });

            const now = Date.now();
            for (const [key, val] of this.lockers) {
                if (now - val.createdAt > 150000) this.lockers.delete(key);
            }

            return new Response(JSON.stringify({ status: 'stored' }), {
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            });
        }

        // ==================== ЗАБРАТЬ ИЗ ЯЧЕЙКИ ====================
        if (request.method === 'GET' && url.pathname === '/beacon') {
            const keyHash = url.searchParams.get('key');
            if (!keyHash) {
                return new Response(JSON.stringify({ error: 'missing_key' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
                });
            }

            const entry = this.lockers.get(keyHash);
            
            if (!entry) {
                return new Response(JSON.stringify({ status: 'empty' }), {
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
                });
            }

            if (entry.taken) {
                return new Response(JSON.stringify({ status: 'taken' }), {
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
                });
            }

            // Отдаём маяк но НЕ удаляем ячейку — помечаем как забранную
            entry.taken = true;
            
            return new Response(JSON.stringify({ status: 'found', packet: entry.packet }), {
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            });
        }

        // ==================== ЗДОРОВЬЕ ====================
        if (url.pathname === '/health') {
            return new Response(JSON.stringify({
                status: 'ok',
                lockers: this.lockers.size,
                timestamp: Date.now()
            }), {
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            });
        }

        return new Response("P2PPong Blind Locker", {
            status: 200,
            headers: { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' }
        });
    }
};

var worker_default = {
    async fetch(request, env) {
        const url = new URL(request.url);
        const id = env.HIVE.idFromName("hive");
        const room = env.HIVE.get(id);
        return room.fetch(request);
    }
};

export { HiveRoom, worker_default as default };
