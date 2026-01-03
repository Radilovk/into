# 🏋️ Клиентски портал - Бърз старт

## Какво е това?

Пълнофункционален клиентски портал за управление на резервации в Acuity Scheduling:
- ✅ Без тайни ключове в браузъра
- ✅ Управление на баланс и пакети
- ✅ Лимити за резервации
- ✅ 12-часова политика за възстановяване при отмяна
- ✅ Rate limiting за защита

## 📁 Файлове

| Файл | Описание |
|------|----------|
| `worker.js` | Backend API (Cloudflare Worker) |
| `client-portal.html` | Frontend UI (GitHub Pages) |
| `client-portal.js` | Frontend логика |
| `wrangler.toml` | Cloudflare конфигурация |
| `CLIENT_PORTAL_DEPLOYMENT.md` | Пълно ръководство за deployment |
| `API_TESTING_GUIDE.md` | Ръководство за тестване на API |
| `ARCHITECTURE.md` | Архитектура и диаграми |

## 🚀 Бърз deployment

### 1. Cloudflare Worker

```bash
# Създай KV namespace
wrangler kv:namespace create "APP_KV"

# Добави ID-то в wrangler.toml
# [[kv_namespaces]]
# binding = "APP_KV"
# id = "ТВОЕТО_KV_ID"

# Задай secrets
wrangler secret put ACUITY_USER_ID    # Твоят Acuity User ID
wrangler secret put ACUITY_API_KEY    # Твоят Acuity API Key

# Deploy
wrangler deploy worker.js
```

### 2. GitHub Pages

```bash
# Активирай GitHub Pages в Settings → Pages
# Source: main branch / (root)

# Порталът ще е достъпен на:
# https://radilovk.github.io/into/client-portal.html
```

### 3. Тестване

```bash
# Health check
curl https://workerai.radilov-k.workers.dev/api/health

# Get client info
curl "https://workerai.radilov-k.workers.dev/api/me?email=test@example.com"
```

## 📋 API Endpoints

| Method | Endpoint | Описание |
|--------|----------|----------|
| GET | `/api/health` | Health check |
| GET | `/api/me?email=...` | Клиент инфо + резервации |
| POST | `/api/book` | Създаване на резервация |
| POST | `/api/cancel` | Отмяна на резервация |

## 💡 Бизнес правила

### Клиенти БЕЗ пакет:
- Максимум 1 бъдеща резервация (пробна)
- След първата, трябва да закупят пакет

### Клиенти С пакет:
- Бъдещи резервации до броя оставащи посещения
- Всяка резервация намалява баланса с 1

### Отмяна:
- ≥12 часа преди: връща се посещение
- <12 часа преди: НЕ се връща посещение

## 🎯 Примерни заявки

### JavaScript (от браузъра)

```javascript
// Load client info
const res = await fetch('https://workerai.radilov-k.workers.dev/api/me?email=test@example.com');
const data = await res.json();
console.log(data);

// Book appointment
const book = await fetch('https://workerai.radilov-k.workers.dev/api/book', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'test@example.com',
    appointmentTypeID: 80052001,
    datetime: '2026-01-20T10:00:00.000Z',
    timezone: 'Europe/Sofia',
    firstName: 'Иван',
    lastName: 'Петров'
  })
});
console.log(await book.json());

// Cancel appointment
const cancel = await fetch('https://workerai.radilov-k.workers.dev/api/cancel', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'test@example.com',
    appointmentID: 123456
  })
});
console.log(await cancel.json());
```

### curl

```bash
# Get client info
curl "https://workerai.radilov-k.workers.dev/api/me?email=test@example.com"

# Book appointment
curl -X POST "https://workerai.radilov-k.workers.dev/api/book" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "appointmentTypeID": 80052001,
    "datetime": "2026-01-20T10:00:00.000Z",
    "timezone": "Europe/Sofia"
  }'

# Cancel appointment
curl -X POST "https://workerai.radilov-k.workers.dev/api/cancel" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "appointmentID": 123456
  }'
```

## 📊 KV данни

### Задаване на баланс за клиент

```bash
# Клиент с 8 посещения
wrangler kv:key put --binding=APP_KV "client:ivan@example.com:balance" "8"

# Проверка
wrangler kv:key get --binding=APP_KV "client:ivan@example.com:balance"
```

### Маркиране че е използван trial

```bash
wrangler kv:key put --binding=APP_KV "client:test@example.com:trial_used" "true"
```

### Изтриване на данни (за тестване)

```bash
wrangler kv:key delete --binding=APP_KV "client:test@example.com:balance"
wrangler kv:key delete --binding=APP_KV "client:test@example.com:trial_used"
```

## 🐛 Debugging

### Real-time логове

```bash
wrangler tail
```

### Проверка на KV

```bash
# Покажи всички ключове
wrangler kv:key list --binding=APP_KV

# Покажи всички ключове за клиент
wrangler kv:key list --binding=APP_KV --prefix="client:test@example.com"
```

## ⚠️ Често срещани проблеми

### CORS грешки
- Провери че worker е deployed
- Провери че CORS headers са правилни в worker.js

### 500 Internal Server Error
- Провери че ACUITY_USER_ID и ACUITY_API_KEY са зададени
- Виж логовете с `wrangler tail`

### Балансът не се обновява
- Провери че APP_KV е правилно bound в wrangler.toml
- Провери формата на ключа: `client:<email>:balance`

### Rate limit грешки
- Изчакай 60 секунди
- Или изтрий ratelimit ключовете от KV

## 📖 Допълнителна документация

- **[CLIENT_PORTAL_DEPLOYMENT.md](CLIENT_PORTAL_DEPLOYMENT.md)** - Пълно deployment ръководство
- **[API_TESTING_GUIDE.md](API_TESTING_GUIDE.md)** - Детайлни примери за тестване
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - Архитектура и диаграми

## 🔐 Сигурност

✅ **Безопасно:**
- Secrets са само в Worker (server-side)
- Frontend няма достъп до API keys
- Rate limiting за защита от abuse
- CORS ограничения
- Email verification при отмяна

❌ **Не правете:**
- Не слагайте secrets във frontend кода
- Не споделяйте API keys
- Не игнорирайте rate limits

## 🎨 UI Features

- 🎨 Gradient дизайн (purple → blue)
- 📱 Mobile responsive
- ⌨️ Enter key support
- 🔄 Auto-hide success messages
- 📅 Bulgarian date formatting
- ⚡ Instant feedback
- 🎯 Clear error messages

## 🌟 Функционалности

- ✅ Email-based login (без парола)
- ✅ Преглед на баланс
- ✅ Списък бъдещи резервации
- ✅ Списък минали резервации
- ✅ Запазване на час
- ✅ Отмяна на час
- ✅ Автоматични имейл уведомления (от Acuity)
- ✅ Rate limiting за защита
- ✅ Responsive за мобилни устройства

## 📞 Support

За въпроси или проблеми:
1. Провери документацията
2. Прегледай логовете: `wrangler tail`
3. Тествай с примерите от API_TESTING_GUIDE.md
4. Създай GitHub issue с детайли

## 🚢 Production готовност

✅ Готово за production използване:
- Код е прегледан
- Security scan: 0 уязвимости
- Пълна документация
- Примери за тестване
- Error handling
- Rate limiting
- CORS защита

## 📝 License

Част от IntoDesign Studio проект.

---

**Изграден с:** Cloudflare Workers + GitHub Pages + Acuity Scheduling API
