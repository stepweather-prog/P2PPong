# 🏓 P2PPong v3.3

**Сигнальный сервер** экосистемы RobinHood P2P.

Связывает клиентов для установки P2P-соединений. Не имеет доступа к содержимому сообщений.

---

## 🔐 Безопасность

| Аспект | Статус |
|:---|:---|
| Знает содержимое сообщений | ❌ Нет (сквозное шифрование) |
| Знает tempKey | ❌ Нет (только SHA-256) |
| Знает sessionSecret | ❌ Нет (вычисляется на клиенте) |
| Хранение сессий | ✅ AES-GCM |

---

## 🌐 Серверы

| Сервер | URL | Скорость |
|:---|:---|:---|
| Render | `p2ppong.onrender.com` | 2-6 сек |
| Workers | `robincall.stephanclaps-491.workers.dev` | <1 сек |

Автоматическое переключение при недоступности одного из серверов.

---

## 🔗 Ссылки

- [Основное приложение](https://stepweather-prog.github.io/ROBINHOOD-P2P/)
- [Приложение для звонков](https://stepweather-prog.github.io/ROBINHOOD-P2PCall/)
- [Сигнальный сервер](https://stepweather-prog.github.io/P2PPong/)

---

## 📄 Лицензия

MIT License
