# API Testing Examples

Това са примерни заявки за тестване на worker.js API endpoints.

## Prerequisites

1. Worker трябва да е deployed на: `https://workerai.radilov-k.workers.dev`
2. Secrets трябва да са конфигурирани (ACUITY_USER_ID, ACUITY_API_KEY)
3. KV namespace APP_KV трябва да е създаден и bound

## Testing with curl

### 1. Health Check

```bash
curl -X GET "https://workerai.radilov-k.workers.dev/api/health"
```

Expected response:
```json
{"success":true,"message":"Service is running"}
```

### 2. Get Client Info

```bash
curl -X GET "https://workerai.radilov-k.workers.dev/api/me?email=test@example.com"
```

Expected response:
```json
{
  "success": true,
  "data": {
    "client": {"email": "test@example.com"},
    "balance": null,
    "upcomingAppointments": [],
    "pastAppointments": [],
    "canBook": true,
    "reason": "Пробна резервация (без пакет)"
  }
}
```

### 3. Book Appointment

```bash
curl -X POST "https://workerai.radilov-k.workers.dev/api/book" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "appointmentTypeID": 80052001,
    "datetime": "2026-01-20T10:00:00.000Z",
    "timezone": "Europe/Sofia",
    "firstName": "Test",
    "lastName": "User",
    "phone": "+359888123456"
  }'
```

Expected response (success):
```json
{
  "success": true,
  "message": "Резервацията е създадена успешно!",
  "data": {
    "appointment": {
      "id": 123456,
      "datetime": "2026-01-20T10:00:00"
    }
  }
}
```

Expected response (when limit reached):
```json
{
  "success": false,
  "message": "Имате вече 1 бъдеща резервация. Без активен пакет можете да имате само 1 резервация."
}
```

### 4. Cancel Appointment

```bash
curl -X POST "https://workerai.radilov-k.workers.dev/api/cancel" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "appointmentID": 123456
  }'
```

Expected response (≥12h before):
```json
{
  "success": true,
  "message": "Резервацията е отменена успешно! Посещението е възстановено.",
  "data": {"refunded": true}
}
```

Expected response (<12h before):
```json
{
  "success": true,
  "message": "Резервацията е отменена успешно! Отмяната е по-малко от 12 часа преди часа - посещението не се връща.",
  "data": {"refunded": false}
}
```

## Testing with Browser Console

Open `client-portal.html` and use browser DevTools console:

### Get Client Info
```javascript
fetch('https://workerai.radilov-k.workers.dev/api/me?email=test@example.com')
  .then(r => r.json())
  .then(data => console.log(data));
```

### Book Appointment
```javascript
fetch('https://workerai.radilov-k.workers.dev/api/book', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    email: 'test@example.com',
    appointmentTypeID: 80052001,
    datetime: '2026-01-20T10:00:00.000Z',
    timezone: 'Europe/Sofia',
    firstName: 'Test',
    lastName: 'User'
  })
}).then(r => r.json()).then(data => console.log(data));
```

### Cancel Appointment
```javascript
fetch('https://workerai.radilov-k.workers.dev/api/cancel', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    email: 'test@example.com',
    appointmentID: 123456
  })
}).then(r => r.json()).then(data => console.log(data));
```

## Setting Up Test Data in KV

### Set Client Balance (8 visits)
```bash
wrangler kv:key put --binding=APP_KV "client:test@example.com:balance" "8"
```

### Check Client Balance
```bash
wrangler kv:key get --binding=APP_KV "client:test@example.com:balance"
```

### Mark Trial as Used
```bash
wrangler kv:key put --binding=APP_KV "client:test@example.com:trial_used" "true"
```

### Check Trial Status
```bash
wrangler kv:key get --binding=APP_KV "client:test@example.com:trial_used"
```

### Reset Trial (for testing)
```bash
wrangler kv:key delete --binding=APP_KV "client:test@example.com:trial_used"
```

## Business Logic Testing Scenarios

### Scenario 1: First-time User (No Package)
1. User has no balance in KV
2. User has no trial_used flag
3. Expected: Can book 1 appointment
4. After booking: trial_used = "true"
5. Second booking attempt: Should fail with "Вече сте използвали вашата пробна резервация"

### Scenario 2: User with Active Package
1. Set balance: `wrangler kv:key put --binding=APP_KV "client:user@example.com:balance" "5"`
2. Expected: Can book up to 5 appointments
3. After each booking: balance decreases by 1
4. When balance = 0: Cannot book more

### Scenario 3: Cancellation with Refund
1. User books appointment for tomorrow
2. User cancels immediately (≥12h before)
3. Expected: If user has balance, it increases by 1
4. Expected: Message says "посещението е възстановено"

### Scenario 4: Cancellation without Refund
1. User books appointment for today + 6 hours
2. User cancels (<12h before)
3. Expected: Appointment cancelled but balance NOT refunded
4. Expected: Message says "посещението не се връща"

### Scenario 5: Rate Limiting
1. Make 11 requests within 60 seconds from same email
2. Expected: First 10 succeed, 11th returns 429 (Too Many Requests)
3. Wait 60+ seconds
4. Expected: Can make requests again

## Error Cases to Test

### Missing Email
```bash
curl -X GET "https://workerai.radilov-k.workers.dev/api/me"
```
Expected: 400 Bad Request

### Invalid Email in Cancel
```bash
curl -X POST "https://workerai.radilov-k.workers.dev/api/cancel" \
  -H "Content-Type: application/json" \
  -d '{"email": "wrong@example.com", "appointmentID": 123456}'
```
Expected: 403 Forbidden (if appointment belongs to different email)

### Missing Required Fields
```bash
curl -X POST "https://workerai.radilov-k.workers.dev/api/book" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'
```
Expected: 400 Bad Request

### Invalid Appointment Type ID
```bash
curl -X POST "https://workerai.radilov-k.workers.dev/api/book" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "appointmentTypeID": 99999999,
    "datetime": "2026-01-20T10:00:00.000Z"
  }'
```
Expected: 500 Internal Server Error (Acuity API will reject)

## Monitoring and Debugging

### Watch Worker Logs in Real-time
```bash
wrangler tail
```

### View Recent Logs
```bash
wrangler tail --format pretty
```

### List All KV Keys (for debugging)
```bash
wrangler kv:key list --binding=APP_KV
```

### View All Keys for a Client
```bash
wrangler kv:key list --binding=APP_KV --prefix="client:test@example.com"
```

## CORS Testing

### Preflight Request
```bash
curl -X OPTIONS "https://workerai.radilov-k.workers.dev/api/me" \
  -H "Origin: https://radilovk.github.io" \
  -H "Access-Control-Request-Method: GET" \
  -v
```

Expected headers in response:
```
Access-Control-Allow-Origin: https://radilovk.github.io
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

## Performance Testing

### Load Test (Simple)
```bash
for i in {1..20}; do
  curl -X GET "https://workerai.radilov-k.workers.dev/api/health" &
done
wait
```

### Concurrent Bookings (Test Race Conditions)
```bash
for i in {1..3}; do
  curl -X POST "https://workerai.radilov-k.workers.dev/api/book" \
    -H "Content-Type: application/json" \
    -d '{
      "email": "test@example.com",
      "appointmentTypeID": 80052001,
      "datetime": "2026-01-20T1'$i':00:00.000Z"
    }' &
done
wait
```

Expected: All should succeed if balance allows, or properly fail with business rule message
