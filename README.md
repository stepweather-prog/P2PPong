# P2PPong Crypto-Core (v6.2) & HTTPR Engine

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Protocol](https://img.shields.io/badge/Protocol-HTTPR%20v1.0-blue)]()

**P2PPong** — автономное JS-криптоядро (Web Crypto API + Web Workers) для защищённой P2P-коммуникации. Транспортный слой **HTTPR** обеспечивает слепую маршрутизацию через плагинную систему транспортов (Cloudflare Workers, Render, Firebase, WebRTC DataChannel).

Построен на принципах ОГАС академика В.М. Глушкова. Оконечное шифрование, одноразовые сеансы, без сохранения ключей между сессиями.

---

## 🔒 Модель безопасности

**Защищает от:**
- Чтения сообщений третьей стороной (AES-256-GCM + ECDH P-256 + Triple Ratchet)
- Подмены сообщений (HMAC-SHA256 на каждом пакете)
- Повторного воспроизведения (одноразовые nonce + ratchet index)
- Раскрытия истории при компрометации ключа (Perfect Forward Secrecy)
- Раскрытия будущих сообщений (Post-Compromise Security через DH Ratchet каждые 10 сообщений)
- Связывания сессий по Peer ID (beaconId скрывает идентификатор от сервера)
- Массового сбора метаданных (публичный пул `/pool`, сервер не знает кто с кем)

**Не защищает от:**
- Корреляции по IP и времени запросов
- MitM при компрометации сигнального сервера (рекомендуется голосовое подтверждение кода)
- Атак на конечные устройства
- Расхождения ratchet при одновременной отправке (автоматическое восстановление)

## 🔐 Криптографический стек

| Компонент | Алгоритм |
|-----------|----------|
| Обмен ключами | ECDH P-256 (ephemeral) |
| Шифрование сообщений | AES-256-GCM |
| Целостность | HMAC-SHA256 |
| Ratchet | Triple Ratchet (Symmetric + DH) |
| Конвертное шифрование | AES-256-GCM (HTTPR Envelope) |
| Маяки | SHA-256(pubKey + "beacon") |
| Код верификации | 7 цифр (crypto.getRandomValues) |

## 🏗️ Архитектура
P2PPong (p2ppong.js) — Криптография, ratchet, маяки
↓ через httpr-p2ppong-bridge.js
HTTPR Core (httpr-core.js) — Плагинная система транспортов
├── HTTPRelayTransport → Cloudflare Workers (основной)
├── HTTPRelayTransport → Render (резервный)
├── Firebase Realtime DB (мгновенная доставка)
└── WebRTC DataChannel (прямой P2P)

## 📡 Сигнальная сеть (три уровня)

| Уровень | Сервер | Назначение |
|---------|--------|------------|
| 1 | Cloudflare Worker | Быстрая маршрутизация, пул `/pool` |
| 2 | Render Server | Горячий резерв |
| 3 | WebRTC DataChannel | Прямой P2P без серверов |

**Эндпоинты:** `POST /beacon`, `GET /beacon?key=`, `DELETE /delete?key=`, `POST /pool`, `GET /pool`, `GET /health`.

Сервер не читает содержимое сообщений, не хранит историю подключений дольше TTL маяка.

## 🎯 Режимы маяков (Колчаны)

**Обычный маяк:** beaconId как ключ на сервере. Peer ID скрыт внутри зашифрованного inner-пакета.

**Публичный колчан (Blind Pool):** Маяк в общем пуле `/pool`. Джойнер скачивает все маяки и перебирает их «вслепую». Сервер не знает, какой маяк кому принадлежит. Максимум 100 маяков, TTL 5 минут.

**Тайный колчан:** beaconId = SHA-256(секрет + соль). Только создатель и джойнер могут вычислить ключ. Требует обмена секретом вне полосы.

## 🔄 Схема рукопожатия

1. **Пир А:** `craftArrow()` → генерирует PeerID, ECDH, beaconId, код (7 цифр) → вычисляет `bk = SHA-256(pubKey + "beacon")` → шифрует inner (AES-256-GCM) → POST /beacon
2. **Пир Б:** получает маяк → проверяет HMAC → расшифровывает inner → генерирует свою ECDH-пару → вычисляет sharedSecret → отправляет beacon-response
3. **Верификация:** Пир Б вводит 7-значный код → Пир А сверяет → канал открывается
4. **Канал:** Triple Ratchet + WebRTC DataChannel (если доступен)

## 📦 Формат пакета HTTPR

### Конверт (видит транспорт)
``json
{
  "v": 1,
  "tid": "a1b2c3d4...",
  "hop": 0,
  "ttl": 5,
  "ts": 1719000000000,
  "pl": "<base64 зашифрованный payload>"
}
Payload (после расшифровки)
{
  "type": "message",
  "from": "peer_id",
  "to": "peer_id",
  "ch": "channel_id",
  "ri": 5,
  "dh": null,
  "data": "<внутренний шифротекст>"
}
🔗 Triple Ratchet (Signal-совместимый)
Инициализация: sendKey = recvKey = sharedSecret, индексы = 0.

Отправка (Symmetric Ratchet): Новый ключ для каждого сообщения через HKDF. Старый sending-ключ уничтожается (Forward Secrecy).

Получение: Прокрутка receiving chain до нужного индекса. Старые receiving-ключи сохраняются (до 3) для восстановления порядка.

DH Ratchet: Каждые 10 сообщений — новый корневой ключ через ECDH. Старый root key уничтожается (Post-Compromise Security).

Авто-ресинхрон: При расхождении ratchet — автоматическое продвижение до нужного индекса.

📝 Формат сообщения (Blob)
Исходные данные → GZIP-сжатие → случайный паддинг (20–70 байт) → HMAC-SHA256 → AES-256-GCM.

Максимальный размер пакета: 65536 байт.

🚀 API
P2PPong (ядро)
P2PPong.init() — инициализация

P2PPong.craftArrow() — создать маяк → beaconId

P2PPong.craftPublicArrow() — маяк в публичный пул

P2PPong.craftSecretArrow(secret) — маяк по секрету

P2PPong.joinBeacon(beaconId) — подключиться к маяку

P2PPong.joinPublicPool() — найти маяк в пуле

P2PPong.confirmVerification() — подтвердить код

P2PPong.sendMessage(chId, text) — отправить текст

P2PPong.sendVoiceMessage(chId, base64) — отправить голос

P2PPong.getBeaconId() / .getVerificationCode() / .getPeerId() / .getPubKey()

События
on('ready') — ядро готово

on('peer-id-generated', { peerId, beaconId, code }) — маяк создан

on('verification-needed', { code }) — требуется ввод кода

on('channel-opened', { channelId, peerId, nick, avatar }) — канал открыт

on('message-received', { channelId, text, timestamp, nick, avatar }) — сообщение

on('message-sent', { channelId, data, status }) — отправлено

on('beacon-timeout') — таймаут маяка

on('error', { message }) — ошибка

HTTPR Core (транспорт)
httpr.registerTransport(transport, config) — зарегистрировать транспорт

httpr.send(payload, routingKey) — отправить пакет

httpr.subscribe(routingKey, callback) — подписаться

httpr.getStats() — статистика транспортов

📊 Ключевые константы
Параметр	Значение
Кривая ECDH	P-256
Шифрование	AES-256-GCM
HMAC	SHA-256
DH Ratchet порог	10 сообщений
Старых ключей	3 (receiving)
Код	7 цифр
TTL маяка	5 минут
TTL канала	10 минут
Голосовое	до 50 КБ, до 10 сек
Пул	до 100 маяков
📋 Требования
Браузер: Chrome 80+, Firefox 75+, Safari 15+, Edge 80+

Web Crypto API (ECDH, AES-GCM, HMAC)

Web Workers

HTTPS (обязательно)

WebRTC (опционально)

CompressionStream API (опционально)

📚 Структура проекта
ROBINHOOD-P2P/
├── p2ppong.js                  — Крипто-ядро (v6.2, Triple Ratchet)
├── httpr-core.js               — HTTPR ядро (v1.0, плагинные транспорты)
├── httpr-p2ppong-bridge.js     — Мост HTTPR ↔ P2PPong (v1.3)
├── crypto-worker.js            — Криптография в Web Worker (v3.0)
├── robinhood-ui.js             — UI (v6.3)
├── index.html                  — PWA-оболочка
├── firebase-config.js          — Конфиг Firebase (в .gitignore)
└── assets/                     — Иконки, аватары, звуки, анимации
⚠️ Ограничения
Нет офлайн-доставки (маяк — 5 минут)

Нет групповых чатов (только P2P и шайки)

Нет push-уведомлений

Код верификации через сервер (рекомендуется голосовое подтверждение)

Криптографические решения не прошли независимый аудит

📄 Лицензия
MIT. Спецификация может свободно использоваться для реализации совместимых клиентов.

⚖️ Ответственность
Проект предоставляется «как есть» (AS IS), без каких-либо гарантий. Разработчик не несёт ответственности за прямой или косвенный ущерб. Пользователь самостоятельно оценивает риски.

🔗 Связанные проекты
RobinHood UI: https://stepweather-prog.github.io/ROBINHOOD-P2P

Cloudflare Worker: https://robincall.stephanclaps-491.workers.dev

Render Server: https://p2ppong-v2.onrender.com

Спецификация: PROTOCOL.md

Слепое рандеву: BLIND-RENDEZVOUS.md
