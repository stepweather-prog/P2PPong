// worker.js — P2PPong Signal Server (Cloudflare Durable Objects)
// Адресная доставка + встроенный трекер для PeerHelp

var HiveRoom = class {
    constructor(state, env) {
        this.subscriptions = new Map(); // peerId → WebSocket (активные соединения)
        this.announcements = new Map();  // peerId → { infoHash, peerId, lastSeen } (для трекера)
    }

    async fetch(request) {
        const url = new URL(request.url);

        // ==================== ВСТРОЕННЫЙ ТРЕКЕР ====================
        if (request.method === 'POST' && url.pathname === '/announce') {
            let body;
            try { body = await request.json(); } catch(e) {
                return new Response(JSON.stringify({ error: 'invalid_json' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
                });
            }

            const { peerId, infoHash } = body;
            if (!peerId || !infoHash) {
                return new Response(JSON.stringify({ error: 'missing_params' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
                });
            }

            // Сохраняем анонс
            this.announcements.set(peerId, {
                peerId,
                infoHash,
                lastSeen: Date.now()
            });

            // Чистим старые анонсы (старше 30 минут)
            const now = Date.now();
            for (const [id, ann] of this.announcements) {
                if (now - ann.lastSeen > 1800000) {
                    this.announcements.delete(id);
                }
            }

            // Возвращаем список пиров с тем же infoHash
            const peers = [];
            for (const [id, ann] of this.announcements) {
                if (ann.infoHash === infoHash && id !== peerId) {
                    peers.push({ peerId: id, lastSeen: ann.lastSeen });
                }
            }

            return new Response(JSON.stringify({
                status: 'ok',
                peers,
                total: this.announcements.size
            }), {
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            });
        }

        // ==================== CORS PREFLIGHT ====================
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

        // ==================== WEBSOCKET ====================
        if (url.pathname === "/ws" || url.pathname === "/ws/") {
            const pair = new WebSocketPair();
            const [client, server] = Object.values(pair);
            server.accept();

            let peerId = null;

            server.addEventListener("message", (event) => {
                let msg;
                try { msg = JSON.parse(event.data); } catch (e) { return; }

                if (msg.action === "subscribe") {
                    peerId = msg.peerId;
                    this.subscriptions.set(peerId, server);
                    return;
                }

                // Адресная доставка
                if (msg.targetPeerId && this.subscriptions.has(msg.targetPeerId)) {
                    const targetWs = this.subscriptions.get(msg.targetPeerId);
                    try { targetWs.send(event.data); } catch (e) {
                        this.subscriptions.delete(msg.targetPeerId);
                    }
                    return;
                }

                // DHT-сигнал
                if (msg.type === 'dht-signal' && msg.targetPeerId) {
                    const targetWs = this.subscriptions.get(msg.targetPeerId);
                    if (targetWs) {
                        try { targetWs.send(event.data); } catch (e) {
                            this.subscriptions.delete(msg.targetPeerId);
                        }
                    }
                    return;
                }

                // Реконнект
                if (msg.action === 'reconnect' && msg.targetPeerId) {
                    const targetWs = this.subscriptions.get(msg.targetPeerId);
                    if (targetWs) {
                        try { targetWs.send(event.data); } catch (e) {
                            this.subscriptions.delete(msg.targetPeerId);
                        }
                    }
                    return;
                }
            });

            server.addEventListener("close", () => {
                if (peerId) this.subscriptions.delete(peerId);
            });

            server.addEventListener("error", () => {
                if (peerId) this.subscriptions.delete(peerId);
            });

            return new Response(null, { status: 101, webSocket: client });
        }

        // ==================== HEALTH CHECK ====================
        if (url.pathname === "/health") {
            return new Response(JSON.stringify({
                status: "ok",
                connections: this.subscriptions.size,
                announcements: this.announcements.size,
                timestamp: Date.now()
            }), {
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            });
        }

        return new Response("P2PPong Signal Server", {
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
