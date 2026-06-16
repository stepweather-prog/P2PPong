// worker.js — P2PPong Signal Server (Cloudflare Durable Objects)
// Только адресная доставка. Никакого broadcast. Никакого хранения метаданных.

var HiveRoom = class {
    constructor(state, env) {
        this.subscriptions = new Map(); // peerId → WebSocket
    }

    async fetch(request) {
        const url = new URL(request.url);

        // WebSocket endpoint
        if (url.pathname === "/ws" || url.pathname === "/ws/") {
            const pair = new WebSocketPair();
            const [client, server] = Object.values(pair);
            server.accept();

            let peerId = null;

            server.addEventListener("message", (event) => {
                let msg;
                try {
                    msg = JSON.parse(event.data);
                } catch (e) {
                    return;
                }

                // Подписка пира
                if (msg.action === "subscribe") {
                    peerId = msg.peerId;
                    this.subscriptions.set(peerId, server);
                    return;
                }

                // АДРЕСНАЯ доставка маяка — только целевому пиру
                if (msg.targetPeerId && this.subscriptions.has(msg.targetPeerId)) {
                    const targetWs = this.subscriptions.get(msg.targetPeerId);
                    try {
                        targetWs.send(event.data);
                    } catch (e) {
                        this.subscriptions.delete(msg.targetPeerId);
                    }
                    return;
                }

                // DHT-сигнал — только целевому пиру
                if (msg.type === 'dht-signal' && msg.targetPeerId) {
                    const targetWs = this.subscriptions.get(msg.targetPeerId);
                    if (targetWs) {
                        try {
                            targetWs.send(event.data);
                        } catch (e) {
                            this.subscriptions.delete(msg.targetPeerId);
                        }
                    }
                    return;
                }

                // Реконнект канала — только целевому пиру
                if (msg.action === 'reconnect' && msg.targetPeerId) {
                    const targetWs = this.subscriptions.get(msg.targetPeerId);
                    if (targetWs) {
                        try {
                            targetWs.send(event.data);
                        } catch (e) {
                            this.subscriptions.delete(msg.targetPeerId);
                        }
                    }
                    return;
                }

                // ВСЁ ОСТАЛЬНОЕ — НЕ ДОСТАВЛЯЕМ НИКОМУ
                // Нет broadcast. Нет утечки метаданных.
            });

            server.addEventListener("close", () => {
                if (peerId) {
                    this.subscriptions.delete(peerId);
                }
            });

            server.addEventListener("error", () => {
                if (peerId) {
                    this.subscriptions.delete(peerId);
                }
            });

            return new Response(null, { status: 101, webSocket: client });
        }

        // Health check
        if (url.pathname === "/health") {
            return new Response(JSON.stringify({
                status: "ok",
                connections: this.subscriptions.size,
                timestamp: Date.now()
            }), {
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*"
                }
            });
        }

        // CORS preflight
        if (url.pathname === "/" && url.searchParams.get("action") === "cors") {
            return new Response("ok", {
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type"
                }
            });
        }

        return new Response("P2PPong Signal Server", {
            status: 200,
            headers: {
                "Content-Type": "text/plain",
                "Access-Control-Allow-Origin": "*"
            }
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

export {
    HiveRoom,
    worker_default as default
};
