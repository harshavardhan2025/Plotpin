# LandPin Property Marketplace — Comprehensive Phase 1 Audit Report

**Date**: 2026-10-22  
**Auditor**: Senior Full-Stack Architect & Application Security Engineer  
**Scope**: Full repository audit across Frontend (`frontend/`), Backend API (`backend/`), AI Service (`ai-service/`), and Database/Storage Layer (Supabase PostgreSQL & Object Storage).

---

## 1. Executive Summary

A comprehensive, ground-truth audit of the LandPin repository was performed. While the platform contains a rich domain implementation (11-stage verification state machine, unified buyer/seller switching, cadastral plot visualization, and hybrid AI ranking), critical security vulnerabilities and severe performance bottlenecks were discovered that impair production readiness:
1. **Critical Secret Key Exposure**: A Supabase secret/service key (`sb_secret_...`) is embedded directly in client-side environment variables and frontend code, causing browser-side security guard failures and exposing full database administrative access.
2. **Critical Authentication Bypass**: Backend authentication middleware trusts unverified client headers (`X-User-Role: admin`, `X-User-Id`), allowing trivial privilege escalation and impersonation without valid JWT signatures.
3. **Severe Public Search Bottleneck**: `GET /api/v1/properties` exhibits a **p50 latency of 2,311.85 ms** and **p95 latency of 4,297.87 ms** due to synchronous, blocking execution of `await db.syncFromSupabase()`, which executes 6 sequential remote HTTP queries over the internet for every single public search request.
4. **Oversized Frontend Bundle**: The main JavaScript chunk is **1,439.47 kB** (382.81 kB gzip) due to monolithic component bundling ([App.jsx](file:///c:/Users/khars/OneDrive/Documents/estate_p/frontend/src/App.jsx) is 205 KB) without code-splitting for Three.js and Leaflet.
5. **Absence of Automated Test Coverage**: Zero automated unit or regression test suites exist in the repository to protect against security or invariant regressions.

---

## 2. Request Flow & Current Architecture

```
┌────────────────────────────────────────────────────────┐
│                   React 18 + Vite Frontend             │
│    Public Site  ·  User Dashboard  ·  Admin Portal     │
│   (VITE_SUPABASE_KEY = sb_secret_... EXPOSED IN CLIENT) │
└───────────────────────────┬────────────────────────────┘
                            │ HTTPS / REST / WSS
┌───────────────────────────▼────────────────────────────┐
│                  Node.js + Express API                 │
│  • authenticate.js (Vulnerable: trusts X-User-Role)    │
│  • propertyController.js: calls syncFromSupabase()     │
│    -> 6 sequential full-table round-trips per request! │
└───┬───────────────────────┬────────────────────────┬───┘
    │                       │                        │
┌───▼──────────────┐  ┌─────▼──────────────┐  ┌──────▼─────────────┐
│ Supabase Postgres│  │  Supabase Storage  │  │  Python + FastAPI  │
│ Remote (Latency: │  │  property-images   │  │  Hybrid AI Ranking │
│ 1.2s - 4.2s seq) │  │  property-documents│  │  (~40ms - 90ms)    │
└──────────────────┘  └────────────────────┘  └────────────────────┘
```

---

## 3. Measurable Baselines (Pre-Optimization Ground Truth)

All metrics were gathered directly from reproducible tests against the live services:

### A. Backend HTTP Latencies
* **Health Check Endpoint (`GET /api/v1/health`)** (50 requests):
  * **Min**: `0.77 ms`
  * **Average**: `1.90 ms`
  * **p50**: `1.05 ms`
  * **p95**: `2.65 ms`
  * **p99**: `37.30 ms`
  * **Status**: 200 OK, Body: 91 bytes
* **Public Search Endpoint (`GET /api/v1/properties`)** (10 requests under test load):
  * **Min**: `1,427.72 ms`
  * **Average**: `2,384.33 ms`
  * **p50**: `2,311.85 ms`
  * **p95**: `4,297.87 ms`
  * **p99**: `4,297.87 ms`
  * **Status**: 200 OK, Body: 17,674 bytes

### B. Database Query Patterns During Search
* Number of remote HTTP queries executed per search: **6 sequential queries**
* Sequence:
  1. `SELECT * FROM properties`
  2. `SELECT * FROM users`
  3. `SELECT * FROM appointments`
  4. `SELECT * FROM inquiries`
  5. `SELECT * FROM support_tickets`
  6. `SELECT * FROM audit_logs`
* Full-table scans executed: Yes (reads entire remote tables into Node.js heap).
* In-memory filtering: 100% of category, purpose, budget, and geospatial distance filtering performed in Node.js JavaScript loop after fetching full tables.

### C. Frontend Production Build Metrics
* **Build Time**: `19.91s`
* **JS Bundle**: `1,439.47 kB` (gzip: `382.81 kB`) — Triggers Rollup chunk size warning (> 500 kB).
* **CSS Bundle**: `14.72 kB` (gzip: `3.87 kB`).
* **Root Component Size**: `App.jsx` = `205,305 bytes` (~3,800 lines of code).

### D. Automated Test Baseline
* Test suites found: `0`
* Pre-existing tests passing: `0` (no test runner configured).

---

## 4. Findings Grouped by Severity

### Critical Severity (P0)

1. **Supabase Secret Key Leakage to Browser**
   * **File Paths**: [frontend/.env](file:///c:/Users/khars/OneDrive/Documents/estate_p/frontend/.env#L4), [frontend/src/lib/supabase.js](file:///c:/Users/khars/OneDrive/Documents/estate_p/frontend/src/lib/supabase.js#L4)
   * **Root Cause**: `VITE_SUPABASE_KEY` was assigned a secret key. Vite embeds all `VITE_*` variables into client-side JS bundles. Supabase SDK detects this in browser environments and throws `Forbidden use of secret API key in browser`.
   * **Impact**: Total compromise of administrative Supabase privileges if deployed, plus client-side failures in browser data operations.

2. **Unauthenticated Privilege Escalation via Client Headers**
   * **File Path**: [backend/src/middleware/authenticate.js](file:///c:/Users/khars/OneDrive/Documents/estate_p/backend/src/middleware/authenticate.js#L20-L45)
   * **Root Cause**: The middleware checks `if (roleHeader === 'admin') req.user = adminUser` and `if (userIdHeader) req.user = matchedUser` without validating a signed JWT token or password. If no token is provided, it silently defaults to `usr_client_001`.
   * **Impact**: Any anonymous user or external script can obtain administrative access (`usr_admin_001`) simply by appending the header `X-User-Role: admin`.

### High Severity (P1)

3. **Blocking Multi-Table Synchronization on Public Endpoints**
   * **File Paths**: [backend/src/controllers/propertyController.js](file:///c:/Users/khars/OneDrive/Documents/estate_p/backend/src/controllers/propertyController.js#L46), [backend/src/config/database.js](file:///c:/Users/khars/OneDrive/Documents/estate_p/backend/src/config/database.js#L693-L810)
   * **Root Cause**: `await db.syncFromSupabase()` is executed inside `searchPublic`, `getById`, `getAppointments`, and `getReviewQueue`. It makes 6 sequential HTTP round-trips to remote Supabase tables, causing latency to spike over 4.2 seconds.
   * **Impact**: Extreme server-side delay, poor user experience, vulnerability to denial-of-service, and excessive database billing.

4. **Insecure Login & Password Verification Absence**
   * **File Path**: [backend/src/controllers/authController.js](file:///c:/Users/khars/OneDrive/Documents/estate_p/backend/src/controllers/authController.js#L74)
   * **Root Cause**: `authController.login` falls back to `db.users[0]` when credentials don't match, and does not compare hashed passwords with bcrypt.
   * **Impact**: Insecure authentication, permitting unauthorized account access.

5. **Client-Side Bypass of Backend API via Supabase Direct Calls**
   * **File Paths**: [frontend/src/lib/supabase.js](file:///c:/Users/khars/OneDrive/Documents/estate_p/frontend/src/lib/supabase.js#L60-L340), [frontend/src/App.jsx](file:///c:/Users/khars/OneDrive/Documents/estate_p/frontend/src/App.jsx)
   * **Root Cause**: Parallel data access paths where frontend directly mutates Supabase records via `supabaseApi` without going through Express authorization and audit logging.
   * **Impact**: Inconsistent audit trails and potential bypass of backend verification invariants.

### Medium Severity (P2)

6. **Monolithic Bundle and Lack of Code Splitting**
   * **File Paths**: [frontend/src/App.jsx](file:///c:/Users/khars/OneDrive/Documents/estate_p/frontend/src/App.jsx), [frontend/vite.config.js](file:///c:/Users/khars/OneDrive/Documents/estate_p/frontend/vite.config.js)
   * **Root Cause**: All views, modals, Three.js 3D visualizers, Leaflet maps, and admin consoles are bundled into a single entry point.
   * **Impact**: 1.44 MB initial bundle slows first-contentful-paint (FCP) and time-to-interactive (TTI) on mobile and slow network connections.

7. **Missing Rate Limiting & Outbound HTTP Timeouts**
   * **File Paths**: [backend/src/app.js](file:///c:/Users/khars/OneDrive/Documents/estate_p/backend/src/app.js), [backend/src/controllers/recommendationController.js](file:///c:/Users/khars/OneDrive/Documents/estate_p/backend/src/controllers/recommendationController.js)
   * **Root Cause**: No request rate limiting on auth/login/OTP endpoints, and no bounded timeout on outbound calls to the Python AI microservice.
   * **Impact**: Vulnerable to brute force and hung backend requests if the AI service encounters network delays.

### Low Severity (P3)

8. **Hardcoded Fallback Credentials**
   * **File Paths**: [backend/src/config/database.js](file:///c:/Users/khars/OneDrive/Documents/estate_p/backend/src/config/database.js#L10), [backend/src/config/storage.js](file:///c:/Users/khars/OneDrive/Documents/estate_p/backend/src/config/storage.js#L12)
   * **Root Cause**: Default string fallback `sb_secret_...` present in code.
   * **Impact**: If `.env` is omitted, the code still binds to the hardcoded project key.

---

## 5. Recommended Implementation Sequence

1. **Phase 2 — Security Hardening**:
   * Sanitize frontend environment: remove `sb_secret_` from `frontend/.env` and `supabase.js`.
   * Secure backend `authenticate.js`: completely remove unverified header trust (`X-User-Role`, `X-User-Id`), enforce strict JWT signature verification, and provide authenticated admin session generation for legitimate admin operations.
   * Enforce password hashing and verification in `authController.js` with bcrypt.
   * Secure document access: strictly verify ownership or admin role before returning signed URLs.
   * Implement automated security regression tests verifying unauthenticated rejections, role escalation blocking, and cross-user isolation.
2. **Phase 3 — Database, Backend & API Performance Optimization**:
   * Remove `await db.syncFromSupabase()` from request handlers (`searchPublic`, `getById`, `getAppointments`, `getReviewQueue`).
   * Implement targeted, indexed PostgreSQL database queries with server-side pagination, category, purpose, and budget filtering.
   * Implement an in-memory bounded TTL cache with automatic invalidation upon writes and moderation actions.
   * Add structured logging, outbound AI request timeouts, and rate limiting.
   * Rerun latency benchmarks to verify p95 latency reduction from ~4,297 ms to target < 200 ms.
