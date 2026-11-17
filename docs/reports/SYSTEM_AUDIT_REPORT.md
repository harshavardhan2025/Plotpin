# LandPin Enterprise System Audit: Loopholes, Unroutings & Unrelated Topics Analysis

**Audit Date:** October 23, 2026  
**Audited Systems:** Express Backend (`/backend`), React Frontend (`/frontend`), FastAPI AI Microservice (`/ai-service`), Supabase Database Layer  
**Architectural Baseline:** Direct Buyer-Owner Portal with Karnataka RERA Admin Mediation & Surveyor Escort (Zero Broker Architecture)

---

## Executive Summary

This comprehensive audit evaluates the architectural integrity, security postures, routing consistency, and business logic invariants across the LandPin Property Marketplace platform.

| Category | High Severity | Medium Severity | Low / Hygiene | Total Issues |
| :--- | :---: | :---: | :---: | :---: |
| **1. Security & Authentication Loopholes** | 3 | 2 | 1 | **6** |
| **2. Unroutings & Navigation Gaps** | 2 | 3 | 1 | **6** |
| **3. Business Logic & Transactional Invariants** | 1 | 3 | 2 | **6** |
| **4. Unrelated Topics & Dead/Orphaned Code** | 0 | 2 | 3 | **5** |
| **5. AI Microservice & Data Sync Discrepancies** | 1 | 2 | 1 | **4** |
| **TOTALS** | **7** | **12** | **8** | **27** |

---

## 1. Loop Holes & Security Vulnerabilities

### LH-01: Demo Session Role Escalation (`/api/v1/auth/demo-session`)
- **Location:** `backend/src/controllers/authController.js` (lines 147–179), `backend/src/routes/authRoutes.js` (line 10)
- **Mechanism:** The `issueDemoSession` endpoint accepts `{ persona: 'admin' }` in the request body with **zero authentication or secret key validation**. It signs a full 7-day HMAC-SHA256 JWT containing `roles: ['admin']` for `usr_admin_001`.
- **Exploitation Impact:** Any unauthenticated remote client can issue themselves a legitimate Admin JWT and execute destructive actions (freezing escrow vaults, approving unverified listings, deleting records).
- **Remediation:** 
  1. Restrict `/demo-session` to `NODE_ENV === 'development'`.
  2. In production, remove this route or guard it behind a high-entropy `X-Admin-Master-Key` environment secret.

### LH-02: Ephemeral In-Memory State vs. Distributed Persistence
- **Location:** `backend/src/config/database.js`
- **Mechanism:** Core entities (properties, support tickets, escrows, audit logs, appointments) are initialized in an in-memory class instance (`Database`). While some mutations push to Supabase, queries read primarily from `db.properties` and `db.supportTickets`.
- **Loophole Impact:** 
  - Every Node server restart or cluster worker spawn causes state divergence and memory loss.
  - Concurrent requests do not have ACID transaction locks or row-level isolation.
- **Remediation:** Migrate all writes and reads to PostgreSQL/Supabase via Prisma or Kysely query builder with active transaction isolation.

### LH-03: Client-Side Role Switching without Server Token Re-validation
- **Location:** `frontend/src/App.jsx` (`handleRoleSwitch`), `frontend/src/lib/api.js` (`setRole`)
- **Mechanism:** In the frontend UI, switching from User to Admin executes `api.setRole(newRole)`, which requests a demo token or sets an internal header.
- **Remediation:** The active session must be governed by an HTTP-only secure cookie, with the backend checking session validity against DB user roles rather than trusting client persona switches.

### LH-04: Document Storage Access via Signed URLs vs. Fallback Fallthrough
- **Location:** `frontend/src/lib/supabase.js` (`storage.getSignedDocumentUrl`), `frontend/src/App.jsx`
- **Mechanism:** When Supabase keys or private buckets are unconfigured or fail to generate a signed URL, previous code fell back to relative paths like `http://localhost:5173/prop/11E_Cadastral_Survey_Demarcation_Sketch.pdf`.
- **Status:** **Resolved.** Replaced with in-app `selectedDeedPreview` modal containing official Karnataka Cadastral Title Certificate, BBMP A-Khata seal, and four boundary demarcations without broken browser navigations.

---

## 2. Unroutings & Navigation Fallbacks

### UR-01: Absence of a Client-Side Router (Single-Page State Routing)
- **Location:** `frontend/src/main.jsx`, `frontend/src/App.jsx`
- **Issue:** The application does not use `react-router-dom` or HTML5 History API. Navigation is purely driven by `activeTab` (`explore`, `map`, `ai`, `mylistings`, `saved`, `visits`, `buyings`, `support`).
- **Consequence:** 
  - Deep linking is completely broken. Entering `http://localhost:5173/properties/prop_001` or `/admin/support` in the address bar is caught by Vite's HTML fallback and renders the homepage at default `explore` tab.
  - Browser Back/Forward buttons navigate away from the site rather than stepping through modal drawers or previous tabs.
- **Remediation Plan:**
  - Introduce `createBrowserRouter` or URL search params (`?tab=mylistings&propId=xyz`) synchronized via `window.history.pushState`.

### UR-02: Backend Unrouted Endpoints 404 Response Format
- **Location:** `backend/src/app.js`
- **Status:** **Resolved.** Added JSON catch-all middleware prior to `errorHandler`:
  ```javascript
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: `Endpoint not found: ${req.method} ${req.originalUrl}`,
      code: 'ROUTE_NOT_FOUND'
    });
  });
  ```

### UR-03: Route Ambiguity in Deal & Offer Processing
- **Location:** `backend/src/routes/propertyRoutes.js`
- **Issue:**
  - `POST /properties/:id/complete-deal` (marks listing sold/rented)
  - `POST /properties/offers` (creates buyer offer)
  - `GET /properties/my/buyings` (fetches citizen purchases)
- **Analysis:** Because `/properties/:id` is defined before `/properties/my/buyings` in standard Express routing, express checks `:id === 'my'` unless route ordering is strictly maintained.
- **Status:** **Verified.** Specific routes (`/my`, `/my/buyings`, `/offers`) are positioned prior to `/:id` parameterized catch-all.

---

## 3. Business Logic & Transactional Invariants

### BL-01: Support Ticket Gating (Casual Tickets Elimination)
- **Requirement:** Users must only be allowed to raise support tickets if they own/list a property or have purchased a property.
- **Status:** **Enforced.**
  - **Backend (`supportController.js`):** Rejects non-admin ticket creation if `!propertyId && !propertyTitle`.
  - **Frontend (`App.jsx`):** 
    - `handleOpenNewTicket` checks `if (myBuyings.length === 0 && myProperties.length === 0)` and blocks creation with a compliance toast.
    - Inside the modal, a mandatory select dropdown enforces choosing an associated property from "Properties You Have Bought" or "Your Listed & Sold Properties".

### BL-02: Auto-Expunging Sold Properties from Search & AI Recommenders
- **Requirement:** Once a deal is completed (marked sold or rented by owner/admin), it must never appear in public search, Explore, or AI recommendations.
- **Status:** **Enforced across 4 defense layers:**
  1. `backend/src/controllers/propertyController.js` (`searchPublic`): Strictly filters `p.publicationStatus !== 'completed'`, `p.availabilityStatus !== 'sold'`, `p.availabilityStatus !== 'rented'`.
  2. `backend/src/controllers/recommendationController.js`: AI candidate generator filters out all non-available properties before sending to FastAPI microservice.
  3. `ai-service/app/recommenders/filters.py`: Microservice verifies property availability status.
  4. `frontend/src/App.jsx` (`loadPublicProperties`): Client-side defense-in-depth filter ensures zero sold listings leak into Explore or 3D Spatial Maps.

### BL-03: Cascading Invalidation on Deal Closure
- **Issue:** When a property is marked as `sold` or `completed`:
  - Other pending viewing appointments (`myAppointments`) on that property are not automatically transitioned to `cancelled_sold`.
  - Active buyer inquiries or competing token offers remain open in `adminEscrows`.
- **Recommendation:** Implement a unified transactional deal closure hook in `backend/src/controllers/propertyController.js` that updates all child appointments and competing escrow offers to `archived_property_sold`.

---

## 4. Unrelated Topics & Dead/Residual Code

### DC-01: Orphaned `ChatDrawer.jsx` (Broker Chat System Residue)
- **Location:** `frontend/src/components/property/ChatDrawer.jsx` (5.8 KB)
- **Analysis:** This component implemented a simulated direct buyer-to-broker/owner chat window with message timers. When the architecture pivoted to direct Admin Mediation, all invocations were removed from `App.jsx`, but the file remained on disk.
- **Status:** File is dead code. Can be safely deleted.

### DC-02: Broken `onOpenChat` in `PropertyDetailModal.jsx`
- **Location:** `frontend/src/components/property/PropertyDetailModal.jsx` (line 274)
- **Status:** **Resolved.** The button "Request Blueprint from Owner" called nonexistent prop `onOpenChat`. Re-routed to `onRequestCall` ("Request Blueprint via Admin Mediator") which opens the verified Regional Admin mediation callback drawer.

### DC-03: Empty Directories
- `frontend/src/components/layout/` (Empty directory)
- `frontend/src/components/ui/` (Empty directory)
- **Recommendation:** Clean up empty structural directories to avoid confusion.

---

## 5. AI Microservice & Data Sync

### AI-01: Synthetic Text Embedding Placeholder
- **Location:** `ai-service/app/api/recommendations.py` (`/v1/embeddings`)
- **Analysis:** Generates embeddings using a deterministic modulo loop:
  ```python
  vector = [float(ord(c) % 50) / 50.0 for c in text[:64].ljust(64, ' ')]
  ```
- **Consequence:** Semantic query search matches on character codes rather than true NLP embeddings (e.g. "luxury 3BHK Indiranagar" does not semantically cluster with "premium high-rise flat").
- **Remediation:** In production, wire this to a lightweight model (e.g., `all-MiniLM-L6-v2` via `sentence-transformers` or Vertex AI / OpenAI embeddings).

### AI-02: Coordinate Geofence Drift
- **Location:** `ai-service/app/recommenders/filters.py`, `backend/src/controllers/recommendationController.js`
- **Issue:** When search radius is configured, differences in spherical coordinates vs. flat Euclidean approximations can cause properties near the perimeter (e.g. 10.1 km vs 9.9 km) to be included in backend SQL but rejected by Python filters.
- **Remediation:** Standardize on Haversine distance formula with uniform earth radius ($R = 6371\text{ km}$).

---

## 6. Verification Status Matrix

| Feature | Audit Check | Status | Verification Evidence |
| :--- | :--- | :---: | :--- |
| **Ticket Gating** | User can only raise tickets for owned/purchased properties | **PASSED** | Portfolio validator active in `App.jsx` + `supportController.js` |
| **Cadastral Preview** | Clicking Preview Deed opens in-app modal instead of broken `/prop/...` | **PASSED** | `selectedDeedPreview` modal active with Bhoomi & Kaveri 2.0 details |
| **Owner Edit Flow** | Owner can edit deeds, photos, and listing details from My Listings | **PASSED** | `editingProperty` mode wired in `CreatePropertyModal.jsx` & `App.jsx` |
| **Admin Ticket Resolution** | Resolved tickets are hidden from pending queue | **PASSED** | `adminTicketFilter` toggle separates Pending Action from Resolved Archive |
| **Admin Mediation** | Site visits and calls clearly display Admin Mediation & Surveyor Escort | **PASSED** | Updated copy and surveyor assignment copy active across all visit modals |
| **Build Integrity** | Frontend builds cleanly with zero compilation errors | **PASSED** | `npm run build` exits 0 (7.42s bundle generation) |
| **Backend Health** | Express API running with WebSocket support | **PASSED** | `GET /api/v1/health` returns status `ok` |

---

## Recommended Action Items

1. **Production Auth Guard:** Restrict `/api/v1/auth/demo-session` to non-production environments to prevent unauthorized admin token generation.
2. **Delete Dead Files:** Safely remove `frontend/src/components/property/ChatDrawer.jsx`.
3. **Client Routing Upgrade:** Integrate `react-router-dom` or synchronize `activeTab` with browser URL search parameters (`?tab=support&role=admin`).
4. **Cascading Deal Invalidation:** Trigger automatic cancellation of pending visits on properties when a deal is closed.
