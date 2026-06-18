// worker.js — P2PPong Blind Locker (Cloudflare Durable Objects)
// Финал — DELETE по /delete?key= через GET

var HiveRoom = class {
    constructor(ctx, env) {
        this.ctx = ctx;
        this.env = env;
        this.TTL_MAP = {
            'waiting_': 300000,
            'emoji_': 300000,
            'ack_': 300000,
            'msg_': 120000,
            'webrtc_': 120000
        };
    }

    async fetch(request) {
        const url = new URL(request.url);

        const securityHeaders = {
            'Access-Control-Allow-Origin': '*',
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

            if (keyHash.length > 128 || packet.length > 8192) {
                return new Response(JSON.stringify({ error: 'too_large' }), {
                    status: 400,
                    headers: { ...securityHeaders, 'Content-Type': 'application/json' }
                });
            }

            const prefix = keyHash.split('_')[0] + '_';
            const ttl = this.TTL_MAP[prefix] || 150000;

            await this.ctx.storage.put(keyHash, {
                packet,
                createdAt: Date.now(),
                taken: false
            }, { expirationTtl: ttl / 1000 });

            const all = await this.ctx.storage.list();
            if (all.size > 500) {
                const now = Date.now();
                const sorted = [...all.entries()]
                    .sort((a, b) => a[1].createdAt - b[1].createdAt);
                const toDelete = sorted.slice(0, sorted.length - 500);
                for (const [key] of toDelete) {
                    await this.ctx.storage.delete(key);
                }
            }

            return new Response(JSON.stringify({ status: 'stored' }), {
                headers: { ...securityHeaders, 'Content-Type': 'application/json' }
            });
        }

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

            const prefix = keyHash.split('_')[0] + '_';
            if (prefix === 'msg_' || prefix === 'webrtc_') {
                entry.taken = true;
                await this.ctx.storage.put(keyHash, entry);
            }

            return new Response(JSON.stringify({ status: 'found', packet: entry.packet }), {
                headers: { ...securityHeaders, 'Content-Type': 'application/json' }
            });
        }

        // Совместимость с клиентом: GET /delete?key=...
        if (url.pathname === '/delete') {
            const keyHash = url.searchParams.get('key');
            if (keyHash) {
                await this.ctx.storage.delete(keyHash);
                return new Response(JSON.stringify({ status: 'deleted' }), {
                    headers: { ...securityHeaders, 'Content-Type': 'application/json' }
                });
            }
            return new Response(JSON.stringify({ error: 'missing_key' }), {
                status: 400,
                headers: { ...securityHeaders, 'Content-Type': 'application/json' }
            });
        }

        if (url.pathname === '/health') {
            const all = await this.ctx.storage.list();
            const now = Date.now();
            let waiting = 0, emoji = 0, ack = 0, msg = 0, webrtc = 0;
            for (const [key, entry] of all) {
                if (key.startsWith('waiting_')) waiting++;
                else if (key.startsWith('emoji_')) emoji++;
                else if (key.startsWith('ack_')) ack++;
                else if (key.startsWith('msg_')) msg++;
                else if (key.startsWith('webrtc_')) webrtc++;
            }
            return new Response(JSON.stringify({
                status: 'ok',
                lockers: all.size,
                breakdown: { waiting, emoji, ack, msg, webrtc },
                timestamp: now
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
