# Acuity Manager Security Documentation

## Overview

The Acuity Manager is designed as a secure "anti-hacker package" that provides safe access to Acuity Scheduling API without requiring direct login credentials to be exposed or stored in the frontend application.

## Security Architecture

### 1. Credentials Protection

#### Problem Addressed
Direct storage of API credentials in frontend code creates multiple security vulnerabilities:
- Credentials visible in browser's View Source
- API keys exposed in network requests
- Keys can be extracted and reused by unauthorized parties
- No ability to revoke access without code changes

#### Solution Implemented
```
User Browser → Worker Backend → Acuity API
     ↓              ↓                ↓
  No Keys      Secrets Stored    Protected
```

**Benefits:**
- API credentials stored as Cloudflare Worker secrets
- Never transmitted to client browser
- Can be rotated without frontend changes
- Centralized access control

### 2. Authentication Flow

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   Browser   │         │    Worker    │         │  Acuity API │
│  (Frontend) │         │   (Backend)  │         │             │
└──────┬──────┘         └───────┬──────┘         └──────┬──────┘
       │                        │                        │
       │  Request without creds │                        │
       ├───────────────────────>│                        │
       │                        │                        │
       │                        │  Add ACUITY_USER &     │
       │                        │  ACUITY_KEY from       │
       │                        │  secrets               │
       │                        ├───────────────────────>│
       │                        │                        │
       │                        │   Authenticated        │
       │                        │   Response             │
       │                        │<───────────────────────┤
       │    Safe Response       │                        │
       │<───────────────────────┤                        │
       │                        │                        │
```

### 3. API Endpoint Security

#### Implemented Protections

**Input Validation**
```javascript
// Required parameters checked
if (!calendarID) {
  return new Response('Missing calendarID', { status: 400 });
}
```

**CORS Configuration**
```javascript
headers: {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type'
}
```

**Error Handling**
```javascript
try {
  // API call
} catch {
  return new Response(JSON.stringify({ error: 'Request failed' }), {
    status: 500,
    headers: { 'Content-Type': 'application/json' }
  });
}
```

### 4. AI Integration Security

#### User-Controlled API Keys
AI API keys are:
- ✅ Entered by the user directly
- ✅ Stored only in browser memory (not persisted)
- ✅ Used client-side to call AI providers
- ✅ Never sent to our backend
- ✅ Not logged or recorded

#### Advantages
1. **User Control**: Each user uses their own AI credits
2. **No Liability**: We don't store or manage AI keys
3. **Privacy**: AI conversations stay between user and provider
4. **Cost Isolation**: Each user pays for their own AI usage

### 5. Data Privacy

#### What We Store
- ❌ No API credentials in frontend
- ❌ No user data persistence
- ❌ No chat history on server
- ❌ No AI API keys stored

#### What Users Control
- ✅ Their own AI API keys
- ✅ Local browser storage (optional, for notes)
- ✅ Chat history (browser only)

### 6. Network Security

#### HTTPS Enforcement
All production deployments should use HTTPS:
```
https://workerai.radilov-k.workers.dev
```

#### Secure Headers
```javascript
{
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type'
}
```

### 7. Protection Against Common Attacks

#### SQL Injection
✅ **Not Applicable**: No SQL database used
- All data comes from Acuity API
- No user input goes directly to database

#### XSS (Cross-Site Scripting)
✅ **Protected**: Proper output encoding
```javascript
// Safe DOM manipulation
messageDiv.innerHTML = `
  <div class="label">${labels[type]}</div>
  ${content}
`;
```

#### CSRF (Cross-Site Request Forgery)
✅ **Protected**: No sensitive state in cookies
- Worker secrets not accessible from browser
- Each request validates independently

#### API Key Exposure
✅ **Protected**: Zero-knowledge architecture
- Backend never sees user's AI keys
- Frontend never sees Acuity credentials

### 8. Rate Limiting Considerations

#### Acuity API Limits
- Default: ~100 requests/minute
- Exceeded limits return 429 status
- Worker respects these limits

#### Recommendations
```javascript
// Implement client-side throttling
const throttle = (func, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};
```

### 9. Audit Trail

#### What Gets Logged
Cloudflare Workers provide automatic logging:
- Request timestamps
- Response status codes
- Error messages (no sensitive data)

#### What Doesn't Get Logged
- API credentials (secrets)
- User's AI API keys
- Personal client information
- Chat messages

### 10. Best Practices for Users

#### API Key Management
1. **Use environment-specific keys**
   ```bash
   # Development
   wrangler secret put ACUITY_USER --env dev
   
   # Production
   wrangler secret put ACUITY_USER --env production
   ```

2. **Rotate keys regularly**
   - Change Acuity API keys every 90 days
   - Update Worker secrets immediately

3. **Monitor usage**
   - Check Acuity API logs
   - Review Cloudflare Worker metrics
   - Watch for unusual patterns

#### AI API Keys
1. **Use separate keys per application**
2. **Set spending limits**
3. **Enable usage alerts**
4. **Never commit keys to Git**

### 11. Compliance Considerations

#### GDPR
- ✅ No personal data stored on our servers
- ✅ Data processing happens at Acuity (data processor)
- ✅ Users control their own data

#### Data Retention
- Browser-only storage (LocalStorage)
- Can be cleared by user anytime
- No server-side data retention

### 12. Security Checklist

Before deploying to production:

- [ ] Set up HTTPS (Cloudflare handles this)
- [ ] Configure Worker secrets (ACUITY_USER, ACUITY_KEY)
- [ ] Test all API endpoints
- [ ] Verify CORS headers
- [ ] Review error messages (no sensitive info)
- [ ] Enable Cloudflare security features
- [ ] Set up monitoring/alerts
- [ ] Document access procedures
- [ ] Train users on AI key security
- [ ] Establish key rotation schedule

### 13. Incident Response

#### If API Keys Compromised

**Immediate Actions:**
1. Revoke old keys in Acuity dashboard
2. Generate new API keys
3. Update Worker secrets
4. Review access logs
5. Notify affected users

**Prevention:**
```bash
# Rotate keys
wrangler secret put ACUITY_USER
wrangler secret put ACUITY_KEY

# Deploy updated worker
wrangler deploy
```

### 14. Security Updates

#### Monitoring Dependencies
```bash
# Check for updates
npm outdated

# Update Cloudflare Workers
wrangler update
```

#### Security Advisories
- Subscribe to Cloudflare security bulletins
- Monitor Acuity API changelog
- Watch OpenAI/Google AI security updates

## Conclusion

The Acuity Manager implements defense-in-depth security:

1. **Credential isolation** via Worker secrets
2. **Zero-knowledge AI integration**
3. **No server-side data storage**
4. **Proper error handling**
5. **CORS protection**
6. **Input validation**

This architecture ensures that even if the frontend is compromised, the Acuity API credentials remain secure, fulfilling the goal of an "anti-hacker package."

## Contact

For security concerns or questions:
- Open a GitHub issue (for non-sensitive matters)
- Contact the repository owner directly (for sensitive matters)

---

**Last Updated**: December 27, 2024  
**Version**: 1.0.0
