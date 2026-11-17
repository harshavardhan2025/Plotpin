# LandPin Real Estate Marketplace — Vulnerability, Bug & Risk Classification

**Classification System:**
- **CRITICAL:** Security breaches, unauthorized data modification, financial/deed leakage.
- **HIGH:** Architectural inconsistencies, broken routing/deep links, concurrency collisions.
- **MEDIUM:** Performance bottlenecks, caching inefficiencies, missing UX states.
- **LOW:** Visual inconsistencies, styling quirks, code hygiene.

---

## 1. Identified Bugs & Vulnerabilities

| ID | Severity | Category | Description | Root Cause | Status |
| :--- | :---: | :--- | :--- | :--- | :---: |
| **SEC-01** | **CRITICAL** | Security | Unauthenticated Admin Demo Session Escalation | `/api/v1/auth/demo-session` previously issued full 7-day admin JWTs without validation. | **RESOLVED** |
| **SEC-02** | **CRITICAL** | Security | Client-Side Role Switching with Hardcoded Credentials | `setApiRole` in `frontend/src/lib/api.js` previously auto-logged in with hardcoded `'adminPass2026!'`. | **RESOLVED** |
| **SEC-03** | **HIGH** | Security | In-Memory OTP & MFA Storage Reset on Restart | `adminMfaSessions` and `otpCache` are in-memory Maps; restarting backend clears active OTPs. | **IN PROGRESS** |
| **ARC-01** | **HIGH** | Architecture | Monolithic Frontend Structure | `App.jsx` was 6,771 lines; prevented clean code splitting and caused large bundle sizes. | **RESOLVED** |
| **ARC-02** | **HIGH** | Architecture | Single-Page State Routing Without Deep Linking | Navigation previously relied solely on `activeTab` React state; page refresh broke navigation. | **RESOLVED** |
| **BUS-01** | **HIGH** | Business Logic | Cross-User Appointment Overlaps | Two buyers could simultaneously book the same 60-minute site visit slot. | **RESOLVED** |
| **BUS-02** | **HIGH** | Business Logic | Support Ticket Spam by Casual Visitors | Unverified non-owners could raise support tickets for properties they didn't own. | **RESOLVED** |
| **BUS-03** | **MEDIUM** | Business Logic | In-Place Modification of Approved Listings | Editing an approved listing previously risked overwriting live verified cadastral details without review. | **RESOLVED** |
| **GEO-01** | **MEDIUM** | Geospatial | Coordinate Inversion & Varied GeoJSON Structures | Different endpoints passed coordinates as `[lng, lat]` vs `{lat, lng}`. | **RESOLVED** |
| **AI-01** | **MEDIUM** | Privacy | Potential Leak of Confidential Deeds via AI Endpoints | Raw property objects containing private document URLs were passed into AI recommenders. | **RESOLVED** |
| **PERF-01**| **MEDIUM** | Performance | Heavy 3D and Map Bundles in Main Chunk | Three.js (531 kB) and jsPDF (391 kB) loaded upfront on homepage. | **RESOLVED** |
| **DOC-01** | **LOW** | Compliance | Regulatory Nomenclature Accuracy | Need to ensure internal mediation is accurately described without claiming official government status. | **MONITORED** |

---

## 2. Immediate Risk Mitigation Roadmap

1. **Phase 1 (Security):** Ensure MFA session persistence across worker processes (e.g. database-backed OTP sessions).
2. **Phase 2 (Database):** Ensure all mutations persist directly into Supabase PostgreSQL tables rather than relying on in-memory mock fallbacks.
3. **Phase 3 (Geospatial):** Standardize all backend storage on PostGIS `POINT(longitude, latitude)`.
4. **Phase 6 (Payments & Deeds):** Enforce server-side signed URL expiration for private cadastral deeds.

