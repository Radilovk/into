# Cloudflare Worker + GitHub Pages Client Portal - Deployment Guide

## Общ преглед

Този проект съдържа клиентски портал за управление на резервации чрез Acuity Scheduling:
- **Backend**: Cloudflare Worker (worker.js)
- **Frontend**: GitHub Pages (client-portal.html, client-portal.js)
- **Данни**: Cloudflare KV за баланси и лимити

## Backend - Cloudflare Worker Setup

### 1. Конфигурация на KV Namespaces

Трябва да създадете 2 KV namespaces:

```bash
# Create APP_KV namespace for client data
wrangler kv:namespace create "APP_KV"

# Create SETTINGS namespace (if not already exists)
wrangler kv:namespace create "SETTINGS"
```

След създаването, запишете ID-тата и ги добавете в `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "SETTINGS"
id = "your_settings_kv_id_here"

[[kv_namespaces]]
binding = "APP_KV"
id = "your_app_kv_id_here"
```

### 2. Настройка на Secrets

Добавете Acuity Scheduling credentials като Worker secrets:

```bash
# Acuity User ID (number)
wrangler secret put ACUITY_USER_ID
# Enter your Acuity User ID when prompted

# Acuity API Key
wrangler secret put ACUITY_API_KEY
# Enter your Acuity API Key when prompted
```

**Забележка за съвместимост**: Worker-ът поддържа и legacy secret names (`ACUITY_USER` и `ACUITY_KEY`) за обратна съвместимост. Ако вече имате настроени тези secrets, не е нужно да ги променяте.

**Важно**: Acuity credentials можете да намерите в:
- Login to Acuity Scheduling
- Go to Settings → Integrations → API
- User ID е числото в края на URL-а
- API Key генерирайте нов, ако нямате

### 3. Deploy на Worker

```bash
# Deploy worker.js to Cloudflare
wrangler deploy worker.js

# Or if you want to specify the name
wrangler deploy worker.js --name workerai
```

Worker ще бъде достъпен на: `https://workerai.radilov-k.workers.dev`

### 4. Проверка на Deployment

Тествайте health endpoint:

```bash
curl https://workerai.radilov-k.workers.dev/api/health
```

Очакван отговор:
```json
{
  "success": true,
  "message": "Service is running"
}
```

## Frontend - GitHub Pages Setup

### 1. Enable GitHub Pages

1. Отидете в Settings на GitHub repo
2. Navigate to Pages
3. Source: Deploy from a branch
4. Branch: main / (root)
5. Save

### 2. Достъп до Client Portal

След активиране на GitHub Pages, порталът ще е достъпен на:
```
https://radilovk.github.io/into/client-portal.html
```

### 3. CORS Configuration

Worker-ът е конфигуриран да приема заявки от:
- `https://radilovk.github.io`

Ако искате да тествате локално, можете временно да промените CORS в worker.js на:
```javascript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',  // Allow all origins (test only!)
  // ...
};
```

## API Endpoints

### GET /api/health
Проверка дали service работи.

**Request:**
```bash
curl https://workerai.radilov-k.workers.dev/api/health
```

**Response:**
```json
{
  "success": true,
  "message": "Service is running"
}
```

### GET /api/appointment-types
Извлича списък с налични услуги от Acuity.

**Request:**
```bash
curl https://workerai.radilov-k.workers.dev/api/appointment-types
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 80052001,
      "name": "Personal Training",
      "duration": 60,
      "price": "50.00",
      "description": "Лична тренировка",
      "category": "Fitness"
    }
  ]
}
```

### GET /api/availability?appointmentTypeID=...&date=...
Извлича свободни часове за конкретна услуга и дата.

**Request:**
```bash
curl "https://workerai.radilov-k.workers.dev/api/availability?appointmentTypeID=80052001&date=2026-01-20"
```

**Response:**
```json
{
  "success": true,
  "data": [
    { "time": "2026-01-20T08:00:00+02:00" },
    { "time": "2026-01-20T08:45:00+02:00" },
    { "time": "2026-01-20T09:00:00+02:00" },
    { "time": "2026-01-20T09:45:00+02:00" }
  ]
}
```

**Забележка:** Часовете са автоматично филтрирани да показват само слотове на :00 и :45 минути (интервали от 45 минути).

### GET /api/me?email=...
Извлича информация за клиент, баланс, резервации.

**Request:**
```bash
curl "https://workerai.radilov-k.workers.dev/api/me?email=client@example.com"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "client": { "email": "client@example.com", "firstName": "Ivan", "lastName": "Petrov" },
    "balance": 8,
    "upcomingAppointments": [
      {
        "id": 12345,
        "datetime": "2026-01-10T10:00:00",
        "type": "Personal Training",
        "duration": 60,
        "appointmentTypeID": 80052001
      }
    ],
    "pastAppointments": [],
    "canBook": true,
    "reason": ""
  }
}
```

### POST /api/book
Създава нова резервация.

**Request:**
```javascript
fetch('https://workerai.radilov-k.workers.dev/api/book', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'client@example.com',
    appointmentTypeID: 80052001,
    datetime: '2026-01-15T14:00:00.000Z',
    timezone: 'Europe/Sofia',
    firstName: 'Ivan',
    lastName: 'Petrov',
    phone: '+359888123456'
  })
})
```

**Response:**
```json
{
  "success": true,
  "message": "Резервацията е създадена успешно!",
  "data": {
    "appointment": { "id": 67890, "datetime": "2026-01-15T14:00:00" }
  }
}
```

### POST /api/cancel
Отменя резервация.

**Request:**
```javascript
fetch('https://workerai.radilov-k.workers.dev/api/cancel', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'client@example.com',
    appointmentID: 67890
  })
})
```

**Response (≥12h before):**
```json
{
  "success": true,
  "message": "Резервацията е отменена успешно! Посещението е възстановено.",
  "data": { "refunded": true }
}
```

**Response (<12h before):**
```json
{
  "success": true,
  "message": "Резервацията е отменена успешно! Отмяната е по-малко от 12 часа преди часа - посещението не се връща.",
  "data": { "refunded": false }
}
```

## KV Data Structure

### Client Balance
```
Key: client:<email>:balance
Value: "8" (string number)
```

**Пример:**
```bash
# Set balance for client
wrangler kv:key put --binding=APP_KV "client:ivan@example.com:balance" "8"

# Get balance
wrangler kv:key get --binding=APP_KV "client:ivan@example.com:balance"
```

### Trial Used Flag
```
Key: client:<email>:trial_used
Value: "true" or "false" (string)
```

**Пример:**
```bash
# Mark trial as used
wrangler kv:key put --binding=APP_KV "client:ivan@example.com:trial_used" "true"

# Check trial status
wrangler kv:key get --binding=APP_KV "client:ivan@example.com:trial_used"
```

## Business Rules

### Клиент БЕЗ активна карта:
- Може да има максимум 1 бъдеща резервация
- След първата резервация, `trial_used` се маркира като `true`
- Не може да запази втори час без да закупи пакет

### Клиент С активна карта (balance > 0):
- Може да има бъдещи резервации до броя оставащи посещения
- При всяка нова резервация, balance намалява с 1
- При отмяна ≥12 часа преди часа, balance се увеличава с 1

### Rate Limiting:
- Максимум 10 заявки на минута на имейл
- TTL = 60 секунди (Cloudflare KV минимум)

## Example Frontend Fetch Requests

### Load Client Info
```javascript
const email = 'client@example.com';
const response = await fetch(
  `https://workerai.radilov-k.workers.dev/api/me?email=${encodeURIComponent(email)}`
);
const result = await response.json();

if (result.success) {
  console.log('Balance:', result.data.balance);
  console.log('Can book:', result.data.canBook);
  console.log('Upcoming:', result.data.upcomingAppointments);
}
```

### Book Appointment
```javascript
const response = await fetch('https://workerai.radilov-k.workers.dev/api/book', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'client@example.com',
    appointmentTypeID: 80052001,
    datetime: new Date('2026-01-20T10:00:00').toISOString(),
    timezone: 'Europe/Sofia',
    firstName: 'Ivan',
    lastName: 'Petrov',
    phone: '+359888123456'
  })
});

const result = await response.json();
if (result.success) {
  alert('Booking successful!');
}
```

### Cancel Appointment
```javascript
const response = await fetch('https://workerai.radilov-k.workers.dev/api/cancel', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'client@example.com',
    appointmentID: 67890
  })
});

const result = await response.json();
if (result.success) {
  alert(result.message);
  console.log('Refunded:', result.data.refunded);
}
```

## Troubleshooting

### Worker returns 500 error
- Check if ACUITY_USER_ID and ACUITY_API_KEY secrets are set correctly
- Check Cloudflare Worker logs: `wrangler tail`

### CORS errors in browser
- Ensure worker is deployed and CORS headers match your domain
- Check browser console for exact error message

### Rate limit errors
- Wait 60 seconds and try again
- Check KV for rate limit keys: `ratelimit:<email>`

### Balance not updating
- Check KV namespace is correctly bound
- Verify KV key format: `client:<email>:balance`
- Use `wrangler kv:key get` to inspect values

## Production Notes

1. **Security**: 
   - Никога не съхранявайте Acuity credentials във frontend кода
   - Всички credentials са Worker secrets (server-side)

2. **Email Notifications**:
   - Acuity автоматично изпраща имейл/SMS уведомления
   - Не е необходимо допълнително да се имплементира

3. **Performance**:
   - Rate limiting защитава от злоупотреба
   - KV TTL >= 60 секунди (Cloudflare изискване)

4. **Monitoring**:
   - Използвайте `wrangler tail` за real-time логове
   - Проверявайте Cloudflare dashboard за метрики

## Support

За въпроси или проблеми, моля проверете:
- Cloudflare Worker logs: `wrangler tail`
- Acuity API documentation: https://developers.acuityscheduling.com/
- GitHub Issues на проекта
