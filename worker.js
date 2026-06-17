// worker.js — P2PPong Blind Locker (Cloudflare Durable Objects)
// ctx.storage для персистентного хранения + HPKP/Expect-CT

var HiveRoom = class {
    constructor(state, env) {
        this.ctx = state;
    }

    async fetch(request) {
        const url = new URL(request.url);

        // Базовые заголовки безопасности
        const securityHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Public-Key-Pins': 'pin-sha256="X3pGTSOuJeEVw989IJ/cEtXUEmy52zs1TZQrU06KUKg="; max-age=2592000; includeSubDomains',
            'Expect-CT': 'max-age=86400, enforce',
            'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY'
        };

        if (request.method === 'OPTIONS') {
            return new Response(null, {
                status: 204,
                headers: {
                    ...securityHeaders,
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
                    headers: { ...securityHeaders, 'Content-Type': 'application/json' }
                });
            }

            const { keyHash, packet } = body;
            if (!keyHash || !packet) {
                return new Response(JSON.stringify({ error: 'missing_params' }), {
                    status: 400,
                    headers: { ...securityHeaders, 'Content-Type': 'application/json' }
                });
            }

            await this.ctx.storage.put(keyHash, {
                packet,
                createdAt: Date.now(),
                taken: false
            });

            // Чистим просроченные (старше 150 секунд)
            const all = await this.ctx.storage.list();
            const now = Date.now();
            for (const [key, val] of all) {
                if (now - val.createdAt > 150000) {
                    await this.ctx.storage.delete(key);
                }
            }

            return new Response(JSON.stringify({ status: 'stored' }), {
                headers: { ...securityHeaders, 'Content-Type': 'application/json' }
            });
        }

        // ==================== ЗАБРАТЬ ИЗ ЯЧЕЙКИ ====================
        if (request.method === 'GET' && url.pathname === '/beacon') {
            const keyHash = url.searchParams.get('key');
            if (!keyHash) {
                return new Response(JSON.stringify({ error: 'missing_key' }), {
                    status: 400,
                    headers: { ...securityHeaders, 'Content-Type': 'application/json' }
                });
            }

            const entry = await this.ctx.storage.get(keyHash);

            if (!entry) {
                return new Response(JSON.stringify({ status: 'empty' }), {
                    headers: { ...securityHeaders, 'Content-Type': 'application/json' }
                });
            }

            if (entry.taken) {
                return new Response(JSON.stringify({ status: 'taken' }), {
                    headers: { ...securityHeaders, 'Content-Type': 'application/json' }
                });
            }

            // Помечаем как забранное, но НЕ удаляем
            entry.taken = true;
            await this.ctx.storage.put(keyHash, entry);

            return new Response(JSON.stringify({ status: 'found', packet: entry.packet }), {
                headers: { ...securityHeaders, 'Content-Type': 'application/json' }
            });
        }

        // ==================== ЗДОРОВЬЕ ====================
        if (url.pathname === '/health') {
            const all = await this.ctx.storage.list();
            return new Response(JSON.stringify({
                status: 'ok',
                lockers: all.size,
                timestamp: Date.now()
            }), {
                headers: { ...securityHeaders, 'Content-Type': 'application/json' }
            });
        }

        return new Response("P2PPong Blind Locker", {
            status: 200,
            headers: { ...securityHeaders, 'Content-Type': 'text/plain' }
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
