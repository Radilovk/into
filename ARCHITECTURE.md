# Архитектура на клиентски портал

## Общ преглед

```
┌─────────────────────────────────────────────────────────────────┐
│                      GitHub Pages Frontend                       │
│                https://radilovk.github.io/into/                  │
│                                                                   │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐  │
│  │ client-portal.   │  │ client-portal.   │  │  Responsive   │  │
│  │      html        │  │       js         │  │   UI Design   │  │
│  └──────────────────┘  └──────────────────┘  └───────────────┘  │
│                                                                   │
│  - Email login                                                    │
│  - Balance display                                                │
│  - Appointments list                                              │
│  - Book/Cancel forms                                              │
│  - No secrets stored                                              │
└───────────────────────────┬───────────────────────────────────────┘
                            │ HTTPS Requests
                            │ (CORS protected)
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│             Cloudflare Worker Backend (worker.js)                │
│           https://workerai.radilov-k.workers.dev                 │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ API Endpoints:                                             │  │
│  │  • GET  /api/health      → Health check                    │  │
│  │  • GET  /api/me          → Client info + appointments      │  │
│  │  • POST /api/book        → Create appointment              │  │
│  │  • POST /api/cancel      → Cancel appointment              │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ Business Logic:                                            │  │
│  │  • Trial users: max 1 booking                              │  │
│  │  • Package users: bookings ≤ balance                       │  │
│  │  • Cancel refund: only if ≥12h before                      │  │
│  │  • Rate limiting: 10 req/min per email                     │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌─────────────┐        ┌─────────────────┐                      │
│  │   Secrets   │        │  KV Namespaces  │                      │
│  │             │        │                 │                      │
│  │ ACUITY_     │        │ APP_KV:         │                      │
│  │ USER_ID     │        │ • balance       │                      │
│  │             │        │ • trial_used    │                      │
│  │ ACUITY_     │        │ • ratelimit     │                      │
│  │ API_KEY     │        │                 │                      │
│  └─────────────┘        └─────────────────┘                      │
└───────────┬───────────────────────────────────────────────────────┘
            │ Acuity API Requests
            │ (Basic Auth)
            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Acuity Scheduling API                         │
│              https://acuityscheduling.com/api/v1                 │
│                                                                   │
│  • Manage appointments                                            │
│  • Manage clients                                                 │
│  • Check availability                                             │
│  • Send email/SMS notifications (automatic)                       │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Client Login (GET /api/me)
```
Browser → Worker → Acuity API (get client)
                 → Acuity API (get appointments)
                 → KV (get balance)
                 → KV (check trial_used)
                 → Calculate canBook
        ← Worker ← (return client data)
```

### 2. Book Appointment (POST /api/book)
```
Browser → Worker → Check rate limit (KV)
                 → Validate business rules
                 → Acuity API (create appointment)
                 → KV (update balance OR mark trial_used)
        ← Worker ← (return success/error)
```

### 3. Cancel Appointment (POST /api/cancel)
```
Browser → Worker → Acuity API (get appointment)
                 → Verify email matches
                 → Check time difference (≥12h?)
                 → Acuity API (cancel appointment)
                 → KV (refund visit if applicable)
        ← Worker ← (return success + refund status)
```

## KV Storage Structure

```
APP_KV Namespace:

client:<email>:balance        → "8"      (string number)
client:<email>:trial_used     → "true"   (string boolean)
ratelimit:<email>             → "5"      (request count, TTL=60s)
```

## Business Rules

### Клиенти БЕЗ активна карта:
```
IF balance === null:
  IF trial_used === "true":
    ❌ Cannot book (message: "Използвали сте пробната резервация")
  ELSE IF upcoming_count >= 1:
    ❌ Cannot book (message: "Може само 1 резервация без пакет")
  ELSE:
    ✅ Can book
    → After booking: trial_used = "true"
```

### Клиенти С активна карта:
```
IF balance > 0:
  IF upcoming_count >= balance:
    ❌ Cannot book (message: "Имате максималния брой резервации")
  ELSE:
    ✅ Can book
    → After booking: balance -= 1
```

### Отмяна на резервация:
```
IF (appointment_time - now) >= 12 hours:
  → Cancel appointment
  → IF balance exists: balance += 1
  → Message: "Посещението е възстановено"
ELSE:
  → Cancel appointment
  → Balance NOT changed
  → Message: "Посещението не се връща"
```

## Security Features

### Frontend (Client-side):
- ❌ No API keys
- ❌ No secrets
- ✅ Only sends email + public data
- ✅ HTTPS only

### Backend (Worker):
- ✅ Secrets stored server-side
- ✅ Basic Auth for Acuity API
- ✅ Email verification for cancels
- ✅ Rate limiting per email
- ✅ CORS restrictions
- ✅ Input validation
- ✅ Error logging (no secrets)

## Deployment Checklist

### 1. Cloudflare Setup
- [ ] Create KV namespace: APP_KV
- [ ] Set secret: ACUITY_USER_ID
- [ ] Set secret: ACUITY_API_KEY
- [ ] Update wrangler.toml with KV ID
- [ ] Deploy: `wrangler deploy worker.js`

### 2. GitHub Pages Setup
- [ ] Enable GitHub Pages (Settings → Pages)
- [ ] Source: main branch / (root)
- [ ] Verify CORS origin in worker.js

### 3. Testing
- [ ] Test /api/health endpoint
- [ ] Test client info retrieval
- [ ] Test booking with trial user
- [ ] Test booking with package user
- [ ] Test cancellation with refund
- [ ] Test cancellation without refund
- [ ] Test rate limiting

### 4. Production Data Setup
For each client with package:
```bash
wrangler kv:key put --binding=APP_KV "client:email@example.com:balance" "8"
```

## Monitoring

### View Logs:
```bash
wrangler tail
```

### Check KV Data:
```bash
wrangler kv:key list --binding=APP_KV
wrangler kv:key get --binding=APP_KV "client:email@example.com:balance"
```

### Analytics:
- Cloudflare Dashboard → Workers → Analytics
- Monitor request volume
- Check error rates
- Review cache hit rates

## Files Overview

| File | Purpose | Lines | Key Features |
|------|---------|-------|--------------|
| `worker.js` | Backend API | 474 | All endpoints, business logic, Acuity integration |
| `client-portal.html` | Frontend UI | 336 | Responsive design, forms, lists |
| `client-portal.js` | Frontend logic | 300 | API calls, UI updates, validation |
| `wrangler.toml` | Config | 14 | KV bindings, AI binding, secrets |
| `CLIENT_PORTAL_DEPLOYMENT.md` | Deployment guide | 354 | Setup instructions, examples |
| `API_TESTING_GUIDE.md` | Testing guide | 310 | Test scenarios, curl examples |

## API Response Format

All responses follow this structure:

### Success:
```json
{
  "success": true,
  "message": "Операцията е успешна",
  "data": { /* response data */ }
}
```

### Error:
```json
{
  "success": false,
  "message": "Описание на грешката"
}
```

### HTTP Status Codes:
- `200` - Success
- `400` - Bad Request (missing/invalid parameters)
- `403` - Forbidden (business rules violation)
- `404` - Not Found (invalid endpoint)
- `429` - Too Many Requests (rate limit)
- `500` - Internal Server Error (Acuity API or Worker error)

## Future Enhancements (Optional)

1. **Package Purchase Integration**
   - Add /api/purchase endpoint
   - Payment gateway integration (Stripe/PayPal)
   - Automatic balance update

2. **Advanced Booking**
   - GET /api/availability endpoint
   - Show available time slots
   - Multi-day booking calendar

3. **Client Profile**
   - Update personal info
   - View booking history statistics
   - Download invoices/receipts

4. **Admin Features**
   - Separate admin dashboard
   - Manage client balances
   - View all bookings
   - Generate reports

5. **Notifications**
   - Custom reminders (beyond Acuity)
   - Push notifications
   - SMS via Twilio integration

6. **Multi-language Support**
   - English/Bulgarian toggle
   - i18n for all text
   - Localized date/time

## Support & Troubleshooting

### Common Issues:

**Problem**: CORS errors in browser
- **Solution**: Verify worker CORS headers match frontend domain

**Problem**: 500 error from worker
- **Solution**: Check secrets are set correctly, view `wrangler tail` logs

**Problem**: Rate limit triggered immediately
- **Solution**: Delete rate limit keys from KV or increase limit

**Problem**: Balance not updating
- **Solution**: Verify KV namespace binding, check key format

**Problem**: Acuity API errors
- **Solution**: Verify credentials, check API limits, review Acuity docs

### Getting Help:

1. Check `wrangler tail` for error logs
2. Review CLIENT_PORTAL_DEPLOYMENT.md
3. Test with API_TESTING_GUIDE.md examples
4. Check Cloudflare Dashboard for errors
5. Review Acuity API documentation
6. Create GitHub issue with error details
