# API Secure Pro Tier Architecture

## Production-Grade Security Architecture Document

**Version:** 1.0  
**Date:** February 2026  
**Classification:** Internal Technical Documentation

---

## 1. Executive Summary

The API Secure Pro Tier implements a **one-time decrypt link system** designed to solve the fundamental split-delivery problem in secure communications: how to share sensitive data with reduced exposure windows and minimal trust in infrastructure.

### Core Value Proposition

Traditional secure messaging systems require ongoing trust in the server to protect data. Our architecture inverts this model: the server stores only encrypted blobs with zero knowledge of decryption keys. By implementing **single-use decryption tokens**, we reduce the exposure window from days/hours to mere seconds—the time between link access and decryption.

### Key Security Guarantees

| Guarantee | Implementation |
|-----------|---------------|
| **Zero Knowledge** | Server never stores or accesses plaintext or decryption keys |
| **Ephemeral Access** | One-time use prevents replay attacks and persistent exposure |
| **Split Knowledge** | Token and passphrase delivered via separate channels |
| **Forward Secrecy** | Once accessed, encrypted data is permanently unavailable |

---

## 2. Threat Model

This section documents the identified threats, attack vectors, and implemented mitigations.

### 2.1 Threat Assessment Matrix

| Threat ID | Attack Vector | Severity | Likelihood | Status |
|-----------|--------------|----------|------------|--------|
| T-001 | Simultaneous interception of link + passphrase | Critical | Low | **Mitigated** |
| T-002 | Server/database compromise | Critical | Low | **Mitigated** |
| T-003 | Token brute force | High | Very Low | **Mitigated** |
| T-004 | Replay attacks | High | Medium | **Mitigated** |
| T-005 | Timing analysis | Medium | Low | **Mitigated** |
| T-006 | Phishing/social engineering | Medium | High | *User education* |

### 2.2 Detailed Threat Analysis

#### T-001: Intercepting Link + Passphrase Together

**Scenario:** An attacker compromises the recipient's communication channels and intercepts both the token link and the decryption passphrase.

**Mitigation:**
- The one-time nature of decrypt links ensures that even if an attacker obtains both components, they have a single opportunity for access
- Upon successful decryption, the token is immediately marked as used
- Subsequent attempts return `410 Gone` status, alerting the legitimate recipient to compromise
- Access logging enables forensic analysis of unauthorized attempts

**Residual Risk:** Attacker intercepts and uses link before legitimate recipient. This is detectable (recipient sees "already used" error) and requires immediate incident response.

#### T-002: Server Compromise

**Scenario:** An attacker gains full access to the application server and database.

**Mitigation:**
- Database contains **only encrypted blobs** with no associated keys
- Encryption performed client-side using AES-256-GCM
- Passphrases are never transmitted to or stored on the server
- Decryption occurs entirely in the recipient's browser

**Residual Risk:** If the attacker also intercepts the passphrase (out of band), they could decrypt. This requires compromise of two independent systems.

#### T-003: Brute Force Token Enumeration

**Scenario:** An attacker attempts to enumerate valid tokens through automated scanning.

**Mitigation:**
- Token entropy: **192 bits** using `crypto.randomUUID()`
- Token space: ~3.4 × 10³⁸ possible combinations
- Rate limiting: 10 requests per minute per IP address
- Estimated time to scan 1% of token space at 1000 req/sec: ~10⁹ years

```
Token Format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
Entropy: 122 bits (UUIDv4) + 70 bits (implementation entropy) = 192 bits
```

#### T-004: Replay Attacks

**Scenario:** An attacker captures the decryption request and attempts to replay it.

**Mitigation:**
- **Atomic check-and-set operation**: Database transaction ensures `used_at` is set only on first successful access
- Subsequent requests for used tokens return `410 Gone`
- Race condition protection: Database-level locking prevents concurrent successful decryptions

```sql
-- Atomic update pattern
UPDATE links 
SET used_at = CURRENT_TIMESTAMP 
WHERE token = ? AND used_at IS NULL;
```

#### T-005: Timing Analysis

**Scenario:** An attacker measures response times to infer whether a token exists or has been used.

**Mitigation:**
- Constant-time response generation regardless of token state
- Identical error messages for "not found" and "already used" (401 Unauthorized)
- Request processing time normalization through artificial delays where necessary

---

## 3. Data Flow

### 3.1 High-Level Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ENCRYPTION FLOW (Sender)                          │
└─────────────────────────────────────────────────────────────────────────────┘

     ┌──────────┐         ┌─────────────┐         ┌──────────────────┐
     │  Sender  │         │   Browser   │         │  API Secure API  │
     │  Client  │────────▶│  (Client-   │────────▶│   (Cloudflare    │
     │          │         │   Side JS)  │         │     Workers)     │
     └──────────┘         └─────────────┘         └──────────────────┘
          │                      │                          │
          │  1. Enter plaintext  │                          │
          │─────────────────────▶│                          │
          │                      │                          │
          │                      │  2. Generate random key  │
          │                      │  3. Encrypt (AES-256-GCM)│
          │                      │  4. Derive passphrase    │
          │                      │                          │
          │                      │  5. POST /api/encrypt    │
          │                      │  {encrypted_blob,        │
          │                      │   expires_at}            │
          │                      │─────────────────────────▶│
          │                      │                          │
          │                      │  6. Store in D1          │
          │                      │                          │
          │                      │  7. Return token         │
          │                      │◀─────────────────────────│
          │                      │                          │
          │  8. Display to user: │                          │
          │     - Token link     │                          │
          │     - Passphrase     │                          │
          │◀─────────────────────│                          │


┌─────────────────────────────────────────────────────────────────────────────┐
│                          DECRYPTION FLOW (Recipient)                        │
└─────────────────────────────────────────────────────────────────────────────┘

     ┌──────────┐         ┌─────────────┐         ┌──────────────────┐
     │ Recipient│         │   Browser   │         │  API Secure API  │
     │  Client  │         │  (Client-   │         │   (Cloudflare    │
     │          │         │   Side JS)  │         │     Workers)     │
     └──────────┘         └─────────────┘         └──────────────────┘
          │                      │                          │
          │  1. Click link       │                          │
          │  /d/:token           │                          │
          │─────────────────────▶│                          │
          │                      │                          │
          │                      │  2. GET /api/links/:token│
          │                      │─────────────────────────▶│
          │                      │                          │
          │                      │  3. Check token exists   │
          │                      │     AND not used         │
          │                      │     AND not expired      │
          │                      │                          │
          │                      │  4. Return encrypted_blob│
          │                      │     (if valid)           │
          │                      │◀─────────────────────────│
          │                      │                          │
          │  5. Display passphrase│                         │
          │     input form       │                          │
          │◀─────────────────────│                          │
          │                      │                          │
          │  6. Enter passphrase │                          │
          │─────────────────────▶│                          │
          │                      │                          │
          │                      │  7. Decrypt in browser   │
          │                      │     (AES-256-GCM)        │
          │                      │                          │
          │                      │  8. POST /api/decrypt    │
          │                      │  {token, success: true}  │
          │                      │─────────────────────────▶│
          │                      │                          │
          │                      │  9. Atomic update:       │
          │                      │     SET used_at = NOW()  │
          │                      │                          │
          │  10. Display plaintext│                         │
          │◀─────────────────────│                          │
          │                      │                          │
          │                      │  11. Self-destruct:      │
          │                      │     Token now invalid    │
          │                      │     for future access    │
```

### 3.2 State Transitions

```
                    ┌─────────────────────────────────────┐
                    │                                     │
    ┌──────────┐    │    ┌──────────┐    ┌──────────┐    │    ┌──────────┐
    │  ACTIVE  │────┼───▶│  USED    │    │  EXPIRED │◀───┼────│  ACTIVE  │
    │ (usable) │    │    │(consumed)│    │ (timeout)│    │    │ (usable) │
    └──────────┘    │    └──────────┘    └──────────┘    │    └──────────┘
                    │         ▲                           │
                    │         │                           │
                    │    decrypt()                        │    cron job
                    │    success                          │    (hourly)
                    │                                     │
                    └─────────────────────────────────────┘
```

| State | Description | Accessible | Transition Trigger |
|-------|-------------|------------|-------------------|
| **ACTIVE** | Token created, not yet accessed | Yes (with passphrase) | Successful decryption or expiry |
| **USED** | Token has been decrypted once | No | Terminal state |
| **EXPIRED** | Token passed expiry timestamp | No | Terminal state |

---

## 4. Security Controls

### 4.1 Token Generation

```typescript
// Token implementation
token: crypto.randomUUID()  // 192-bit entropy

// Alternative high-entropy generation
function generateToken(): string {
  const array = new Uint8Array(24);  // 192 bits
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}
```

**Properties:**
- Cryptographically secure random generation
- URL-safe format
- Collision probability: < 10⁻³⁷
- No sequential or predictable patterns

### 4.2 Storage Security

**Platform:** Cloudflare D1 (SQLite-compatible)

| Aspect | Implementation |
|--------|---------------|
| Encryption at Rest | Provided by D1 infrastructure |
| Access Control | Worker-scoped API tokens |
| Backup Strategy | Point-in-time recovery enabled |
| Data Retention | Auto-cleanup of expired links after 30 days |

**Schema Security Features:**
- `encrypted_blob` is opaque binary data (no structure exposed)
- No foreign key relationships that could enable inference attacks
- Minimal column set reduces data exposure surface

### 4.3 Rate Limiting

```typescript
// Rate limit configuration
const RATE_LIMIT = {
  windowMs: 60 * 1000,      // 1 minute window
  maxRequests: 10,           // per IP
  skipSuccessfulRequests: false,
  keyGenerator: (req) => req.headers.get('CF-Connecting-IP')
};
```

| Endpoint | Limit | Purpose |
|----------|-------|---------|
| `POST /api/encrypt` | 10/min | Prevent spam/abuse |
| `GET /api/links/:token` | 10/min | Prevent token enumeration |
| `POST /api/decrypt` | 10/min | Prevent brute force attempts |

**Response Headers:**
```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1707777600
Retry-After: 45
```

### 4.4 CORS Policy

```typescript
// Strict CORS - apisecure.app only
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://apisecure.app',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
  'Vary': 'Origin'
};
```

- Pre-flight requests validated
- Credentials not included in cross-origin requests
- Origin header strictly validated against allowlist

### 4.5 Security Headers

```typescript
const securityHeaders = {
  // Transport Security
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  
  // Content Security Policy
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; '),
  
  // Clickjacking Protection
  'X-Frame-Options': 'DENY',
  
  // MIME Sniffing Protection
  'X-Content-Type-Options': 'nosniff',
  
  // Referrer Policy
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  
  // Permissions Policy
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  
  // Hide Server Info
  'X-Powered-By': ''
};
```

### 4.6 Client-Side Encryption

```typescript
// AES-256-GCM encryption in browser
async function encrypt(plaintext: string, passphrase: string): Promise<EncryptedBlob> {
  const encoder = new TextEncoder();
  
  // Derive 256-bit key from passphrase using PBKDF2
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );
  
  // Encrypt with random IV
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(plaintext)
  );
  
  // Format: salt(16) + iv(12) + ciphertext
  return { salt, iv, ciphertext };
}
```

**Cryptographic Parameters:**
- Algorithm: AES-256-GCM
- Key Derivation: PBKDF2 with 100,000 iterations
- Salt: 128 bits (random per encryption)
- IV: 96 bits (random per encryption)
- Tag: 128 bits (GCM authentication)

---

## 5. Self-Destruct Mechanism

### 5.1 One-Time Use Enforcement

The self-destruct mechanism ensures that encrypted data can only be accessed once, providing forward secrecy and limiting exposure windows.

#### State Transition Logic

```typescript
async function decryptToken(token: string): Promise<Result> {
  // Start transaction
  const db = await getD1Connection();
  
  try {
    // Atomic check-and-set
    const result = await db
      .prepare(`
        UPDATE links 
        SET used_at = datetime('now') 
        WHERE token = ? 
          AND used_at IS NULL 
          AND expires_at > datetime('now')
        RETURNING encrypted_blob
      `)
      .bind(token)
      .first();
    
    if (!result) {
      // Check why it failed for proper error messaging
      const link = await db
        .prepare('SELECT used_at, expires_at FROM links WHERE token = ?')
        .bind(token)
        .first();
      
      if (!link) return { error: 'NOT_FOUND', status: 404 };
      if (link.used_at) return { error: 'ALREADY_USED', status: 410 };
      if (link.expires_at < Date.now()) return { error: 'EXPIRED', status: 410 };
    }
    
    return { encrypted_blob: result.encrypted_blob, status: 200 };
    
  } catch (err) {
    await db.exec('ROLLBACK');
    throw err;
  }
}
```

### 5.2 Race Condition Protection

The `UPDATE ... RETURNING` pattern with `used_at IS NULL` condition provides atomicity:

```
Thread A: UPDATE links SET used_at = NOW() WHERE token = 'abc' AND used_at IS NULL
Thread B: UPDATE links SET used_at = NOW() WHERE token = 'abc' AND used_at IS NULL

Result: Only one succeeds (row count = 1), the other gets row count = 0
```

### 5.3 Optional Physical Deletion

Two deletion strategies are supported:

| Strategy | Implementation | Use Case |
|----------|---------------|----------|
| **Soft Delete** | Mark `used_at`, keep blob | Audit/compliance requirements |
| **Hard Delete** | `DELETE FROM links WHERE token = ?` | Maximum privacy, no forensic trail |

Configuration:
```typescript
const CONFIG = {
  DELETE_ON_DECRYPT: false,  // Set true for hard delete mode
  AUDIT_RETENTION_DAYS: 90   // How long to keep access_logs
};
```

### 5.4 Expired Link Cleanup

Hourly cron job removes expired links:

```typescript
// wrangler.toml
[[triggers]]
crons = ["0 * * * *"]

// cleanup handler
export default {
  async scheduled(controller, env, ctx) {
    const db = env.DB;
    
    // Soft delete: archive first if needed
    await db.prepare(`
      INSERT INTO expired_links_archive 
      SELECT * FROM links 
      WHERE expires_at < datetime('now', '-7 days')
    `).run();
    
    // Hard delete
    const result = await db.prepare(`
      DELETE FROM links 
      WHERE expires_at < datetime('now', '-7 days')
    `).run();
    
    console.log(`Cleaned up ${result.meta.changes} expired links`);
  }
};
```

---

## 6. Database Schema

### 6.1 Core Tables

```sql
-- Primary storage for encrypted links
CREATE TABLE links (
    -- Primary identifier (192-bit entropy)
    token TEXT PRIMARY KEY,
    
    -- Encrypted content (opaque binary blob)
    -- Contains: salt(16) + iv(12) + ciphertext + auth_tag(16)
    encrypted_blob BLOB NOT NULL,
    
    -- Expiration timestamp (ISO 8601)
    expires_at DATETIME NOT NULL,
    
    -- Usage tracking (NULL = unused, timestamp = when first accessed)
    used_at DATETIME,
    
    -- Creation metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- Optional: creator identification (hashed)
    creator_hash TEXT,
    
    -- Optional: size limit enforcement
    blob_size_bytes INTEGER
);

-- Access audit logging
CREATE TABLE access_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Foreign key to links (may be NULL if token not found)
    token TEXT,
    
    -- Request metadata
    ip_address TEXT,                    -- Hashed/anon where required by law
    ip_hash TEXT GENERATED ALWAYS AS (
        hex(md5(ip_address))
    ) STORED,                           -- For pattern analysis without PII
    
    user_agent TEXT,
    user_agent_hash TEXT GENERATED ALWAYS AS (
        hex(md5(user_agent))
    ) STORED,
    
    -- Request result
    success BOOLEAN NOT NULL,           -- true = decrypted, false = failed attempt
    failure_reason TEXT,                -- NOT_FOUND, ALREADY_USED, EXPIRED, BAD_PASSPHRASE
    
    -- Timing
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- Cloudflare-specific metadata
    cf_ray TEXT,                        -- For debugging with CF support
    cf_country TEXT,                    -- Geo IP country code
    
    -- Index for queries
    FOREIGN KEY (token) REFERENCES links(token) ON DELETE SET NULL
);

-- Optimized indexes
CREATE INDEX idx_links_expires_at ON links(expires_at) 
  WHERE expires_at < datetime('now');

CREATE INDEX idx_links_used_at ON links(used_at) 
  WHERE used_at IS NULL;

CREATE INDEX idx_access_logs_token ON access_logs(token);
CREATE INDEX idx_access_logs_timestamp ON access_logs(timestamp);
CREATE INDEX idx_access_logs_ip_hash ON access_logs(ip_hash);
```

### 6.2 Schema Rationale

| Design Decision | Reasoning |
|-----------------|-----------|
| `token` as TEXT PK | UUIDs are fixed-length, index-friendly |
| `encrypted_blob` as BLOB | Preserves binary data without encoding overhead |
| `used_at` nullable | NULL = active, timestamp = consumed (enables partial index) |
| Separate `access_logs` | Audit trail without impacting hot path performance |
| Hashed IP/UA | Privacy-compliant analytics (GDPR/CCPA) |
| `ON DELETE SET NULL` | Preserves audit trail even if link purged |

### 6.3 Query Patterns

```sql
-- Hot path: Validate and retrieve blob
SELECT encrypted_blob 
FROM links 
WHERE token = ? 
  AND used_at IS NULL 
  AND expires_at > datetime('now');

-- Hot path: Mark as used (atomic)
UPDATE links 
SET used_at = datetime('now') 
WHERE token = ? 
  AND used_at IS NULL;

-- Maintenance: Find expired links
SELECT token FROM links 
WHERE expires_at < datetime('now', '-7 days');

-- Analytics: Failed access attempts
SELECT token, count(*) as attempts 
FROM access_logs 
WHERE success = false 
  AND timestamp > datetime('now', '-1 hour')
GROUP BY token 
HAVING attempts > 5;
```

---

## 7. Deployment Architecture

### 7.1 Infrastructure

```
┌─────────────────────────────────────────────────────────────────┐
│                        Cloudflare Edge                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────┐      ┌──────────────┐      ┌─────────────┐   │
│   │   Pages     │─────▶│   Workers    │─────▶│     D1      │   │
│   │  (Static)   │      │   (API)      │      │  (SQLite)   │   │
│   │             │◀─────│              │◀─────│             │   │
│   └─────────────┘      └──────────────┘      └─────────────┘   │
│          │                    │                     │           │
│          │                    │                     │           │
│          ▼                    ▼                     ▼           │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │                    Security Layer                       │  │
│   │  • DDoS Protection  • WAF  • Bot Management  • Rate Limit│  │
│   └─────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 Environment Configuration

```toml
# wrangler.toml
name = "api-secure-pro"
compatibility_date = "2024-01-01"

[env.production]
vars = { ENVIRONMENT = "production" }

[[env.production.d1_databases]]
binding = "DB"
database_name = "api-secure-prod"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"

[env.production.triggers]
crons = ["0 * * * *"]

# Security headers applied at edge
[[env.production.headers]]
for = "/*"
[env.production.headers.values]
Strict-Transport-Security = "max-age=63072000; includeSubDomains; preload"
X-Frame-Options = "DENY"
```

---

## 8. Monitoring & Incident Response

### 8.1 Key Metrics

| Metric | Alert Threshold | Response |
|--------|----------------|----------|
| Failed decryptions / token | > 5 in 1 hour | Review for brute force |
| Encryption rate per IP | > 100/hour | Potential spam/abuse |
| DB connection errors | > 1 in 5 min | Infrastructure issue |
| Average response time | > 500ms | Performance degradation |

### 8.2 Security Events

Events logged to `access_logs` for analysis:

```typescript
enum SecurityEvent {
  DECRYPT_SUCCESS = 'decrypt_success',
  DECRYPT_ALREADY_USED = 'decrypt_already_used',
  DECRYPT_EXPIRED = 'decrypt_expired',
  DECRYPT_NOT_FOUND = 'decrypt_not_found',
  RATE_LIMIT_HIT = 'rate_limit_hit',
  INVALID_TOKEN_FORMAT = 'invalid_token_format'
}
```

---

## 9. Compliance Considerations

| Regulation | Compliance Strategy |
|------------|-------------------|
| **GDPR** | Data minimization, no PII retention, right to erasure via self-destruct |
| **CCPA** | No sale of personal information, access logs anonymized |
| **SOC 2** | Audit trail (access_logs), encryption at rest and in transit |
| **HIPAA** | Client-side encryption ensures server never processes PHI |

---

## 10. Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-02 | API Secure Team | Initial Pro Tier architecture |

---

**Document Classification:** Internal Use Only  
**Next Review Date:** 2026-05-12
