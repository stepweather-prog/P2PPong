<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>P2PPong v5.0</title>
    <link rel="icon" type="image/png" sizes="192x192" href="https://stepweather-prog.github.io/ROBINHOOD-P2P/assets/avatars/001-.png">
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://p2ppong.onrender.com https://p2ppong-v2.onrender.com https://robincall.stephanclaps-491.workers.dev https://* wss://*; img-src 'self' data: https://stepweather-prog.github.io;">
    <style>
        :root { --bg: #0d1a0c; --bg2: #1a2a1f; --accent: #c4a24b; --accent2: #e8d5a3; --text: #e8e2c7; --dim: #b8a87a; --border: #c4a24b; --green: #4caf50; --red: #f44336; --orange: #ff9800; --blue: #4bc4d0; }
        * { margin:0; padding:0; box-sizing:border-box; }
        body { background:linear-gradient(135deg,var(--bg),var(--bg2)); color:var(--text); font-family:'Segoe UI','Inter',sans-serif; display:flex; align-items:center; justify-content:center; min-height:100vh; padding:20px; }
        .container { width:100%; max-width:500px; background:rgba(20,30,18,0.95); border:2px solid var(--border); border-radius:20px; padding:24px; box-shadow:0 8px 32px rgba(0,0,0,0.5); }
        h2 { text-align:center; background:linear-gradient(135deg,var(--accent2),var(--accent)); -webkit-background-clip:text; background-clip:text; color:transparent; margin-bottom:20px; }
        .status-row { display:flex; align-items:center; gap:8px; justify-content:center; margin-bottom:16px; flex-wrap:wrap; }
        .status-dot { width:10px; height:10px; border-radius:50%; }
        .status-dot.online { background:var(--green); box-shadow:0 0 8px var(--green); }
        .status-dot.offline { background:var(--red); }
        .status-dot.checking { background:var(--orange); animation:pulse 1s infinite; }
        .status-dot.mesh { background:var(--blue); box-shadow:0 0 8px var(--blue); }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .server-cards { display:flex; gap:10px; margin-bottom:16px; flex-wrap:wrap; }
        .server-card { flex:1; min-width:90px; padding:12px; border-radius:12px; border:1px solid var(--border); text-align:center; cursor:pointer; transition:0.2s; background:rgba(255,255,255,0.03); }
        .server-card:hover { background:rgba(196,162,75,0.15); }
        .server-card.active { border-color:var(--green); background:rgba(76,175,80,0.1); }
        .server-card.mesh-active { border-color:var(--blue); background:rgba(75,196,208,0.1); }
        .server-name { font-weight:bold; font-size:0.9em; color:var(--accent2); }
        .server-status { font-size:0.65em; color:var(--dim); margin-top:4px; }
        .log-box { background:rgba(0,0,0,0.4); border-radius:10px; padding:10px; max-height:200px; overflow-y:auto; font-family:monospace; font-size:0.6em; color:var(--dim); margin-top:12px; }
        .log-entry { margin:3px 0; } .log-entry.success { color:var(--green); } .log-entry.error { color:var(--red); } .log-entry.info { color:var(--accent2); } .log-entry.mesh { color:var(--blue); }
        .stats-row { display:flex; justify-content:space-between; font-size:0.6em; color:var(--dim); margin-top:12px; flex-wrap:wrap; gap:4px; }
        button { width:100%; padding:12px; border-radius:10px; border:1px solid var(--border); background:rgba(196,162,75,0.1); color:var(--text); cursor:pointer; font-weight:bold; font-size:0.9em; transition:0.2s; margin-top:8px; }
        button:hover { background:rgba(196,162,75,0.25); }
        .badge { display:inline-block; padding:2px 8px; border-radius:10px; font-size:0.7em; font-weight:bold; }
        .badge-pwa { background:rgba(76,175,80,0.2); color:var(--green); } .badge-browser { background:rgba(255,152,0,0.2); color:var(--orange); } .badge-mesh { background:rgba(75,196,208,0.2); color:var(--blue); }
    </style>
</head>
<body>
<div class="container">
    <h2>🏹 P2PPong v5.0</h2>
    <div class="status-row">
        <span class="status-dot checking" id="status-dot"></span>
        <span id="status-text">Проверка...</span>
        <span class="badge" id="pwa-badge">Браузер</span>
        <span class="badge badge-mesh" id="mesh-badge" style="display:none;">Mesh</span>
    </div>
    <div class="server-cards">
        <div class="server-card active" id="card-render">
            <div class="server-name">🌐 Render</div>
            <div class="server-status" id="render-status">🟡 Проверка...</div>
        </div>
        <div class="server-card" id="card-workers">
            <div class="server-name">⚡ Workers</div>
            <div class="server-status" id="workers-status">🟡 Проверка...</div>
        </div>
        <div class="server-card" id="card-mesh">
            <div class="server-name">📡 Пиры</div>
            <div class="server-status" id="mesh-status">Поиск...</div>
        </div>
    </div>
    <button id="btn-refresh">🔄 Проверить</button>
    <div class="log-box" id="log-box"></div>
    <div class="stats-row">
        <span>ID: <span id="node-id">-</span></span>
        <span>Каналы: <span id="ch-count">0/2</span></span>
        <span>Пиры: <span id="peer-count">0</span></span>
    </div>
</div>

<script>
(function() {
    'use strict';
    // ===== КОНФИГУРАЦИЯ СЕРВЕРОВ =====
    const SERVERS = [
        { id: 'render', url: 'https://p2ppong-v2.onrender.com', label: 'Render', short: 'R' },
        { id: 'workers', url: 'https://robincall.stephanclaps-491.workers.dev', label: 'Workers', short: 'W' }
    ];
    const PONG_SESSIONS_KEY = 'robinhood_pong_sessions';
    const PONG_SECURE_KEY = 'pong_secure_v1';

    let currentServer = 'render';      // Основной сервер для интерфейса и fallback
    let channels = {};
    let handshakeSecret = null;
    let pollIntervals = {};
    let serverStatuses = { render: 'checking', workers: 'checking', mesh: 'checking' };
    let isCreatingSession = false;
    let meshPeers = [];
    let meshActive = false;

    const parentOrigin = document.referrer || '';
    const isRobinCall = parentOrigin.includes('ROBINHOOD-P2PCall');
    const APP_BASE_URL = isRobinCall ? 
        'https://stepweather-prog.github.io/ROBINHOOD-P2PCall/' : 
        'https://stepweather-prog.github.io/ROBINHOOD-P2P/';

    const NODE_ID = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2)+Date.now().toString(36);
    const isPWA = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone || false;
    const MAX_CH = isPWA ? 20 : 2;
        // ===== УТИЛИТЫ =====
    function $(id) { return document.getElementById(id); }
    function log(msg, type = 'info') {
        const entry = document.createElement('div'); entry.className = 'log-entry ' + type;
        entry.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
        const box = $('log-box'); box.insertBefore(entry, box.firstChild);
        if (box.children.length > 50) box.lastChild.remove();
        console.log('[P2PPong]', msg);
    }

    function updateUI() {
        const cs = serverStatuses[currentServer];
        $('status-dot').className = 'status-dot ' + (cs === 'online' ? 'online' : cs === 'mesh' ? 'mesh' : cs === 'checking' ? 'checking' : 'offline');
        $('status-text').textContent = cs === 'online' ? '✅ Готов' : cs === 'mesh' ? '📡 Mesh' : cs === 'checking' ? '🟡 Проверка...' : '❌ Офлайн';
        $('pwa-badge').textContent = isPWA ? 'PWA (20)' : 'Браузер (2)';
        $('ch-count').textContent = Object.keys(channels).length + '/' + MAX_CH;
        $('node-id').textContent = NODE_ID.substring(0, 10) + '...';
        $('card-render').classList.toggle('active', currentServer === 'render');
        $('card-workers').classList.toggle('active', currentServer === 'workers');
        $('card-mesh').classList.toggle('mesh-active', currentServer === 'mesh');
        $('render-status').textContent = (serverStatuses.render === 'online' ? '🟢 ' : '🔴 ') + (serverStatuses.render === 'online' ? 'Онлайн' : 'Офлайн');
        $('workers-status').textContent = (serverStatuses.workers === 'online' ? '🟢 ' : '🔴 ') + (serverStatuses.workers === 'online' ? 'Онлайн' : 'Офлайн');
        $('mesh-status').textContent = meshPeers.length + ' пиров';
        $('peer-count').textContent = meshPeers.length;
        $('mesh-badge').style.display = meshActive ? 'inline-block' : 'none';
    }

    function sendToParent(msg) { 
        if (window.parent && window.parent !== window) { 
            try { window.parent.postMessage(msg, '*'); } catch (e) {} 
        } 
    }

    // ===== API-ЗАПРОС К КОНКРЕТНОМУ СЕРВЕРУ =====
    async function apiCallToServer(serverId, method, path, body = null, retries = 1) {
        const server = SERVERS.find(s => s.id === serverId);
        if (!server) return null;
        for (let a = 0; a <= retries; a++) {
            const ctrl = new AbortController();
            const timeout = setTimeout(() => ctrl.abort(), serverId === 'workers' ? 5000 : 10000);
            try {
                const opts = { method, headers: { 'Content-Type': 'application/json' }, signal: ctrl.signal };
                if (body) opts.body = JSON.stringify(body);
                const res = await fetch(server.url + path, opts);
                clearTimeout(timeout);
                const text = await res.text();
                if (!res.ok) {
                    if (a < retries) { await new Promise(r => setTimeout(r, 2000)); continue; }
                    return null;
                }
                try { return JSON.parse(text); } catch (e) { return text; }
            } catch (e) {
                clearTimeout(timeout);
                if (a < retries) { await new Promise(r => setTimeout(r, 3000)); continue; }
                return null;
            }
        }
        return null;
    }

    // Устаревший apiCall для обратной совместимости и там, где нужен текущий сервер
    async function apiCall(method, path, body = null) {
        return apiCallToServer(currentServer, method, path, body);
    }

    // ===== ХЕШИРОВАНИЕ И ТОКЕНЫ =====
    function generateToken() { return crypto.randomUUID?.() || Math.random().toString(36).substring(2)+Math.random().toString(36).substring(2); }
    async function sha256(text) { 
        const data = new TextEncoder().encode(text);
        const hash = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join(''); 
    }

    // ===== ОПРОС СЕРВЕРА (ПОЛЛИНГ) =====
    function startPolling(sid, serverId) {
        if (pollIntervals[sid]) return;
        let lastTime = Date.now();
        const poll = async () => {
            try {
                const url = serverId || channels[sid]?.server;
                const res = await apiCallToServer(url, 'GET', '/message?id=' + sid + '&since=' + lastTime);
                if (!res?.messages) return;
                for (const m of res.messages) {
                    const ch = channels[sid];
                    if (!ch) continue;
                    let text = m.packet;
                    try {
                        const parsed = JSON.parse(m.packet);
                        if (parsed.sender === NODE_ID) { lastTime = Math.max(lastTime, m.time); continue; }
                        text = parsed.text || m.packet;
                    } catch (err) {}
                    sendToParent({ type: 'message', text, sender: 'Друг', channelId: sid });
                    lastTime = Math.max(lastTime, m.time);
                }
            } catch (e) {}
        };
        poll();
        pollIntervals[sid] = setInterval(poll, 4000);
    }

    function stopPolling(sid) {
        if (pollIntervals[sid]) { clearInterval(pollIntervals[sid]); delete pollIntervals[sid]; }
    }

    function stopAllPolling() { Object.keys(pollIntervals).forEach(stopPolling); }

    // ===== MESH: ОБНАРУЖЕНИЕ СОСЕДЕЙ (ПОКА ТОЛЬКО BROADCASTCHANNEL) =====
    function discoverMeshPeers() {
        try {
            const bc = new BroadcastChannel('pong-mesh');
            bc.postMessage({ type: 'discover', nodeId: NODE_ID });
            bc.onmessage = (e) => {
                if (e.data?.type === 'discover' && e.data.nodeId !== NODE_ID) {
                    if (!meshPeers.includes(e.data.nodeId)) {
                        meshPeers.push(e.data.nodeId);
                        log('Новый пир: ' + e.data.nodeId.substring(0,10), 'mesh');
                        serverStatuses.mesh = 'mesh';
                        updateUI();
                    }
                }
            };
            try { localStorage.setItem('pong_mesh_peers', JSON.stringify(meshPeers)); } catch(e) {}
        } catch(e) {}
    }

    // ===== УНИВЕРСАЛЬНОЕ СОЗДАНИЕ МАЯКА (МУЛЬТИСЕРВЕР) =====
    async function createSession(clientTempKey) {
        if (Object.keys(channels).length >= MAX_CH) {
            sendToParent({ type: 'error', text: 'Максимум ' + MAX_CH + ' каналов' });
            return;
        }
        if (isCreatingSession) return;
        isCreatingSession = true;

        const tempKey = clientTempKey || generateToken();
        const tempKeyHash = await sha256(tempKey);
        
        log('Создание маяка на всех серверах...', 'info');
        
        // Параллельная отправка на Render и Workers
        const results = [];
        for (const server of SERVERS) {
            // Workers принимает только tempKeyHash, Render может принять и tempKey, и tempKeyHash
            const body = server.id === 'workers' ? { tempKeyHash } : { tempKey: tempKey, tempKeyHash };
            const res = await apiCallToServer(server.id, 'POST', '/beacon', body);
            if (res?.sessionId) {
                results.push({ sessionId: res.sessionId, server: server.id });
                log('Маяк на ' + server.label + ': ' + res.sessionId.substring(0,8), 'success');
            } else {
                log('Не удалось создать маяк на ' + server.label, 'error');
            }
        }
        
        if (results.length === 0) {
            isCreatingSession = false;
            sendToParent({ type: 'error', text: 'Все серверы не отвечают' });
            return;
        }

        // Берём первый успешный id как основной
        const primary = results[0];
        const sid = primary.sessionId;
        const sessionSecret = await sha256(tempKey);
        
        channels[sid] = {
            tempKey,
            sessionSecret,
            status: 'waiting',
            isCreator: true,
            createdAt: Date.now(),
            server: primary.server,
            allServers: results.map(r => r.server)
        };
        
        // Формируем ссылку с параметром servers
        const serversParam = results.map(r => r.server).join(',');
        const link = APP_BASE_URL + '?id=' + sid + '&servers=' + serversParam + '#key=' + tempKey;
        sendToParent({ type: 'session-created', sessionId: sid, key: tempKey, fullLink: link });
        log('Основной маяк: ' + sid.substring(0,8) + ' [' + primary.server + ']', 'success');
        updateUI();
        isCreatingSession = false;

        waitForMatch(sid);
    }

    async function waitForMatch(sid) {
        const ch = channels[sid];
        if (!ch) return;
        const start = Date.now();
        let matched = false;
        
        while (Date.now() - start < 90000) {
            // Проверяем статус маяка на его основном сервере
            const check = await apiCallToServer(ch.server, 'GET', '/beacon?id=' + sid);
            if (check?.matched) { matched = true; break; }
            
            // Если не matched, пробуем другие серверы через 10 секунд (если есть allServers)
            if (ch.allServers && ch.allServers.length > 1 && (Date.now() - start) > 10000) {
                for (const srv of ch.allServers) {
                    if (srv === ch.server) continue;
                    const altCheck = await apiCallToServer(srv, 'GET', '/beacon?id=' + sid);
                    if (altCheck?.matched) { matched = true; break; }
                }
            }
            if (matched) break;
            await new Promise(r => setTimeout(r, 5000));
        }
        
        if (!matched) {
            delete channels[sid];
            saveSessions();
            sendToParent({ type: 'error', text: 'Таймаут ожидания' });
            updateUI();
            return;
        }
        
        ch.status = 'open';
        startPolling(sid, ch.server);
        saveSessions();
        sendToParent({ type: 'channel-open', secret: ch.sessionSecret, channelId: sid, role: 'creator' });
        log('Канал открыт!', 'success');
        updateUI();
    }

    // ===== УНИВЕРСАЛЬНЫЙ ПОИСК МАЯКА (МУЛЬТИСЕРВЕР) =====
    async function acceptSession(sid, tempKey) {
        if (Object.keys(channels).length >= MAX_CH) {
            sendToParent({ type: 'error', text: 'Максимум каналов' });
            return;
        }
        if (channels[sid]) {
            sendToParent({ type: 'channel-open', secret: channels[sid].sessionSecret, channelId: sid, role: 'receiver' });
            return;
        }
        
        log('Поиск маяка: ' + sid.substring(0,8) + '...', 'info');
        
        // Определяем список серверов для поиска
        const urlParams = new URLSearchParams(window.location.search);
        const serversParam = urlParams.get('servers') || SERVERS.map(s => s.id).join(',');
        const serversList = serversParam.split(',');
        
        const findKey = tempKey || generateToken();
        const keyHash = await sha256(findKey);
        
        for (const srvId of serversList) {
            const body = srvId === 'workers' ? { tempKeyHash: keyHash } : { tempKey: findKey };
            const res = await apiCallToServer(srvId, 'POST', '/find', body);
            if (res?.status === 'matched') {
                const actualSid = res.sessionId || sid;
                const sessionSecret = await sha256(findKey);
                channels[actualSid] = {
                    tempKey: findKey,
                    sessionSecret,
                    status: 'open',
                    isCreator: false,
                    createdAt: Date.now(),
                    server: srvId,
                    allServers: serversList
                };
                if (actualSid !== sid) channels[sid] = { ...channels[actualSid] };
                startPolling(actualSid, srvId);
                if (actualSid !== sid) startPolling(sid, srvId);
                saveSessions();
                sendToParent({ type: 'channel-open', secret: sessionSecret, channelId: actualSid, role: 'receiver' });
                log('Подключено через ' + srvId + '!', 'success');
                updateUI();
                return;
            }
        }
        
        sendToParent({ type: 'error', text: 'Маяк не найден' });
    }

    // ===== ОТПРАВКА СООБЩЕНИЯ С ПРОВЕРКОЙ ОШИБОК =====
    async function sendMessage(channelId, text, secret) {
        const ch = channels[channelId];
        if (!ch) {
            sendToParent({ type: 'error', text: 'Канал не найден', channelId });
            return;
        }
        const serverId = ch.server;
        const packet = JSON.stringify({ text, sender: NODE_ID, time: Date.now() });
        const res = await apiCallToServer(serverId, 'POST', '/message', { sessionId: channelId, packet });
        
        if (!res || res.error) {
            log('Ошибка отправки, возможно сессия истекла: ' + channelId, 'error');
            // Если сессия не найдена, удаляем канал и уведомляем
            delete channels[channelId];
            stopPolling(channelId);
            saveSessions();
            sendToParent({ type: 'error', text: 'session_not_found', channelId });
        }
    }

    // ===== БЕЗОПАСНОЕ ПЕРЕКЛЮЧЕНИЕ СЕРВЕРА =====
    function switchServer(server) {
        if (server === currentServer || isCreatingSession) return;
        
        // Проверяем, есть ли активные каналы, привязанные к другому серверу
        const activeChannels = Object.values(channels).filter(ch => ch.status === 'open' && ch.server !== server);
        if (activeChannels.length) {
            sendToParent({ type: 'error', text: 'active_channels_present', channels: activeChannels.map(ch => ch.sessionId) });
            log('Переключение заблокировано: есть активные каналы', 'error');
            return;
        }
        
        currentServer = server;
        stopAllPolling();
        handshakeSecret = null;
        sendToParent({ type: 'server-switched', server: currentServer });
        
        // Переподключаемся к новому серверу
        checkServer(server).then(() => {
            if (serverStatuses[server] === 'online') {
                handshakeSecret = generateToken();
                sendToParent({ type: 'pong-ready', handshake: handshakeSecret });
                restoreSessions();
            }
        });
        updateUI();
    }

    // ===== ПРОВЕРКА СТАТУСА СЕРВЕРОВ =====
    async function checkServer(server) {
        if (server === 'mesh') {
            serverStatuses.mesh = meshPeers.length > 0 ? 'mesh' : 'checking';
            updateUI();
            return meshPeers.length > 0;
        }
        const ping = await apiCallToServer(server, 'GET', '/ping');
        serverStatuses[server] = ping ? 'online' : 'offline';
        if (server === currentServer && ping && !handshakeSecret) {
            handshakeSecret = generateToken();
            sendToParent({ type: 'pong-ready', handshake: handshakeSecret });
        }
        updateUI();
        return ping !== null;
    }

    async function checkAllServers() {
        if (isCreatingSession) return;
        const checks = SERVERS.map(s => checkServer(s.id));
        checks.push(checkServer('mesh'));
        await Promise.all(checks);
        
        if (serverStatuses[currentServer] === 'offline') {
            const fallbackOrder = [...SERVERS.map(s => s.id), 'mesh'];
            for (const s of fallbackOrder) {
                if (serverStatuses[s] === 'online' || serverStatuses[s] === 'mesh') {
                    currentServer = s;
                    break;
                }
            }
        }
        updateUI();
    }
        // ===== БЕЗОПАСНОЕ ХРАНЕНИЕ СЕССИЙ (AES-GCM) =====
    async function getPongStorageKey() {
        let kb = localStorage.getItem(PONG_SECURE_KEY);
        if (!kb) {
            const k = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
            const r = await crypto.subtle.exportKey("raw", k);
            kb = btoa(String.fromCharCode(...new Uint8Array(r)));
            localStorage.setItem(PONG_SECURE_KEY, kb);
            return k;
        }
        const r = Uint8Array.from(atob(kb), c => c.charCodeAt(0));
        return await crypto.subtle.importKey("raw", r, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
    }

    async function saveSessions() {
        try {
            const s = Object.entries(channels)
                .filter(([_, c]) => c.status === 'open')
                .map(([id, c]) => ({
                    id,
                    key: c.tempKey,
                    secret: c.sessionSecret,
                    creator: c.isCreator,
                    createdAt: c.createdAt,
                    server: c.server,
                    allServers: c.allServers || []
                }));
            if (!s.length) {
                localStorage.removeItem(PONG_SESSIONS_KEY);
                return;
            }
            const sk = await getPongStorageKey();
            const iv = crypto.getRandomValues(new Uint8Array(12));
            const enc = new TextEncoder().encode(JSON.stringify(s));
            const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, sk, enc);
            const combined = new Uint8Array(iv.length + new Uint8Array(ct).length);
            combined.set(iv);
            combined.set(new Uint8Array(ct), iv.length);
            localStorage.setItem(PONG_SESSIONS_KEY, btoa(String.fromCharCode(...combined)));
        } catch (e) {
            log('Ошибка сохранения сессий: ' + e.message, 'error');
        }
    }

    async function restoreSessions() {
        try {
            const stored = localStorage.getItem(PONG_SESSIONS_KEY);
            if (!stored) return;
            const sk = await getPongStorageKey();
            const combined = Uint8Array.from(atob(stored), c => c.charCodeAt(0));
            const iv = combined.slice(0, 12);
            const ct = combined.slice(12);
            const dec = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, sk, ct);
            const sessions = JSON.parse(new TextDecoder().decode(dec));
            const now = Date.now();
            const restored = [];
            for (const sc of sessions) {
                if (now - sc.createdAt > 7 * 24 * 60 * 60 * 1000) continue; // старше 7 дней — удаляем
                // Проверяем, жив ли маяк на сервере
                const check = await apiCallToServer(sc.server, 'GET', '/beacon?id=' + sc.id);
                if (check && check.matched) {
                    channels[sc.id] = {
                        tempKey: sc.key,
                        sessionSecret: sc.secret,
                        status: 'open',
                        isCreator: sc.creator,
                        createdAt: sc.createdAt,
                        server: sc.server,
                        allServers: sc.allServers || [sc.server]
                    };
                    startPolling(sc.id, sc.server);
                    restored.push({ channelId: sc.id, secret: sc.secret, role: sc.creator ? 'creator' : 'receiver' });
                }
            }
            if (restored.length > 0) {
                sendToParent({ type: 'restored-channels', channels: restored });
                log('Восстановлено каналов: ' + restored.length, 'success');
            }
            updateUI();
        } catch (e) {
            log('Ошибка восстановления сессий: ' + e.message, 'error');
        }
    }

    // ===== ПИНГ СЕССИИ ДЛЯ ПРОДЛЕНИЯ TTL (РАЗ В 5 МИНУТ) =====
    let sessionPingInterval = null;
    function startSessionPing() {
        if (sessionPingInterval) return;
        sessionPingInterval = setInterval(async () => {
            for (const [id, ch] of Object.entries(channels)) {
                if (ch.status !== 'open') continue;
                // Пустой запрос на сервер для продления TTL
                await apiCallToServer(ch.server, 'POST', '/message', { sessionId: id, packet: '__PING__' });
            }
        }, 300000); // 5 минут
    }

    // ===== ОБРАБОТЧИК СООБЩЕНИЙ ОТ РОДИТЕЛЬСКОГО ОКНА =====
    window.addEventListener('message', (event) => {
        let origin;
        try { origin = new URL(event.origin).hostname; } catch (e) { return; }
        const allowed = ['stepweather-prog.github.io', 'localhost', '127.0.0.1'];
        if (!allowed.some(a => origin.endsWith(a))) return;
        if (event.source !== window.parent) return;

        const data = event.data;
        if (!data || !data.action) return;

        // handshake — подтверждение соединения
        if (data.action === 'handshake') {
            if (data.handshake === handshakeSecret) {
                handshakeSecret = null;
                sendToParent({ type: 'handshake-ok' });
                log('Handshake подтверждён', 'success');
            }
            return;
        }

        // send — отправка сообщения в канал
        if (data.action === 'send') {
            let ch = channels[data.channelId];
            if (!ch) {
                for (const [id, channel] of Object.entries(channels)) {
                    if (channel.sessionSecret === data.secret) {
                        ch = channel;
                        data.channelId = id;
                        break;
                    }
                }
            }
            if (!ch) {
                sendToParent({ type: 'error', text: 'Канал не найден' });
                return;
            }
            sendMessage(data.channelId, data.text, data.secret);
            return;
        }

        // server-switch — переключение сервера (с защитой)
        if (data.action === 'server-switch' && data.server) {
            switchServer(data.server);
            return;
        }

        // get-status — запрос текущего статуса
        if (data.action === 'get-status') {
            sendToParent({
                type: 'server-status',
                server: currentServer,
                status: serverStatuses[currentServer],
                channels: Object.keys(channels).length,
                max: MAX_CH,
                isPWA
            });
            return;
        }

        // create — создание новой стрелы (маяка)
        if (data.action === 'create') {
            createSession(data.tempKey);
            return;
        }

        // accept — принятие чужой стрелы
        if (data.action === 'accept' && data.id) {
            acceptSession(data.id, data.key || '');
            return;
        }
    });

    // ===== ИНИЦИАЛИЗАЦИЯ =====
    async function init() {
        const urlParams = new URLSearchParams(window.location.search);
        const urlServer = urlParams.get('server');
        if (urlServer === 'render' || urlServer === 'workers' || urlServer === 'mesh') {
            currentServer = urlServer;
        } else {
            const saved = localStorage.getItem('robinhood_server');
            if (saved === 'render' || saved === 'workers' || saved === 'mesh') currentServer = saved;
        }

        try { meshPeers = JSON.parse(localStorage.getItem('pong_mesh_peers') || '[]'); } catch(e) {}
        discoverMeshPeers();
        updateUI();

        await checkAllServers();
        await restoreSessions();
        startSessionPing();

        log('P2PPong v5.0 готов [' + currentServer + ']', 'success');
    }

    // ===== ОБРАБОТЧИКИ UI (КАРТОЧКИ, КНОПКА ПРОВЕРКИ) =====
    $('card-render').addEventListener('click', () => switchServer('render'));
    $('card-workers').addEventListener('click', () => switchServer('workers'));
    $('card-mesh').addEventListener('click', () => switchServer('mesh'));
    $('btn-refresh').addEventListener('click', checkAllServers);

    // ===== ЖИВУЧЕСТЬ: ПРИ СВОРАЧИВАНИИ ОСТАНАВЛИВАЕМ ПОЛЛИНГ, ПРИ ВОЗВРАТЕ ВОЗОБНОВЛЯЕМ =====
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            Object.keys(pollIntervals).forEach(stopPolling);
        } else {
            Object.keys(channels).forEach(sid => {
                if (channels[sid]?.status === 'open') startPolling(sid, channels[sid].server);
            });
            checkAllServers();
        }
    });

    // ===== ПЕРЕД ЗАКРЫТИЕМ СОХРАНЯЕМ СЕССИИ И ОСТАНАВЛИВАЕМ ПОЛЛИНГ =====
    window.addEventListener('beforeunload', () => {
        if (Object.keys(channels).length > 0) saveSessions();
        stopAllPolling();
        if (sessionPingInterval) clearInterval(sessionPingInterval);
    });

    // ===== ЗАПУСК =====
    init();
})();
</script>
</body>
</html>
