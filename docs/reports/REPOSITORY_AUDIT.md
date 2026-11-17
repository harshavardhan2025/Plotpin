# LandPin Real Estate Marketplace — Comprehensive Repository Audit & Technical Baseline

**Audit Date:** October 31, 2026  
**Auditor:** Principal Software Architect, Application Security & Database Engineer  
**Scope:** Full codebase audit covering `/frontend`, `/backend`, `/ai-service`, database schemas, storage policies, and automated test harnesses.

---

## 1. System Inventory & Architecture Overview

LandPin is an enterprise-grade, direct Buyer-to-Owner (Zero-Broker) property marketplace operating in Karnataka, India, with direct cadastral title deed verification and regional administrator conference mediation.

### Technology Stack Matrix

| Subsystem | Technology | Current Version / Baseline | Status |
| :--- | :--- | :--- | :--- |
| **Frontend Framework** | React 18 | `react@18.2.0`, `vite@5.4.21` | Modularized; React Router DOM v6 |
| **Styling & Icons** | Tailwind CSS / Lucide | `clsx@2.1.0`, `tailwind-merge@2.2.1`, `lucide-react@0.344.0` | Forest green palette tokens |
| **Geospatial & 3D** | Leaflet / Three.js | `leaflet@1.9.4`, `three@0.186.1` | 2D marker clustering & 3D WebGL canvas |
| **Document Engine** | jsPDF | `jspdf@4.2.1` | In-app Cadastral deed rendering |
| **Backend REST & WS** | Node.js Express | `express@4.18.2`, `socket.io@4.7.2` | REST API on `/api/v1` with Socket.io |
| **Authentication** | Custom JWT + Supabase | `jsonwebtoken@9.0.2`, `bcryptjs@2.4.3` | Unified Citizen account & Admin MFA |
| **Database & Storage** | Supabase PostgreSQL | `@supabase/supabase-js@2.118.0` | Schemas, RLS policies, private buckets |
| **AI Microservice** | Python FastAPI | FastAPI 0.110+, NumPy, Sentence Transformers | Semantic embeddings & weighted scoring |

---

## 2. Directory Structure & Asset Inventory

```
estate_p/
├── ai-service/
│   ├── app/
│   │   ├── api/recommendations.py     # FastAPI Recommendation, Embeddings & Semantic Search
│   │   ├── recommenders/              # Candidate generation & feature weighting
│   │   ├── schemas/                   # Pydantic contract validation models
│   │   ├── services/ranking_service.py # S = 0.35R + 0.25L + 0.20B + 0.15F + 0.05Q
│   │   ├── config.py                  # Environment config & dynamic CORS origins
│   │   └── main.py                    # FastAPI entrypoint with health endpoints
│   └── tests/test_ai.py               # AI test suite
├── backend/
│   ├── src/
│   │   ├── config/database.js         # Supabase client adapter & initial dataset
│   │   ├── controllers/               # Auth, Property, Appointment, Admin, Recommendation, Support
│   │   ├── middleware/                # Authenticate, Authorize, RateLimiter, UploadValidator
│   │   ├── routes/                    # REST route definitions
│   │   ├── services/                  # Email, OTP, LinkToken, RegistrationRecovery
│   │   ├── utils/                     # PropertyEligibility, geoHelpers
│   │   ├── app.js                     # Express application configuration
│   │   └── server.js                  # HTTP & WebSocket server bootstrap
│   ├── scripts/                       # Database seed and clear routines
│   └── tests/                         # 9 regression test suites (243 tests)
├── frontend/
│   ├── src/
│   │   ├── components/                # 3D, Auth, Common, Forms, Layout, Maps, Profile, Property
│   │   ├── contexts/                  # AuthContext, PropertyContext
│   │   ├── pages/                     # Explore, Map, AI, Portfolio, Saved, Visits, Support, Admin
│   │   ├── routes/AppRoutes.jsx       # Lazy-loaded route map
│   │   ├── utils/                     # propertyHelpers, geoMapHelpers
│   │   ├── lib/                       # api.js, supabase.js
│   │   ├── App.jsx                    # Modular root component
│   │   └── main.jsx                   # Entry point
│   ├── public/                        # Static brand assets
│   └── vite.config.js                 # Rollup chunking & proxy configuration
└── scripts/
    ├── supabase_schema.sql            # PostgreSQL schema definitions & constraints
    └── security_rls_hardening.sql     # Row Level Security policies
```

---

## 3. Subsystem Audit Findings

### 3.1 Authentication & Authorization
- **Unified Citizen Identity:** Verified. Citizens use a single mobile phone number for both buyer and seller personas.
- **OTP Lifecycle:** Verified. 6-digit numeric OTP generated via `crypto.randomInt()`, expiring in 5 minutes, with single-use burning and rate-limiting.
- **Admin Authentication:** Hardened. Standalone `/admin/login` requiring verified credentials and 6-digit MFA OTP with timing-safe comparison.
- **Demo Sessions:** Secured. `issueDemoSession` permanently rejects `persona === 'admin'` and is disabled in production.

### 3.2 Database & Data Consistency
- **Persistence Layer:** Database operations interact with Supabase PostgreSQL tables (`public.profiles`, `public.properties`, `public.property_documents`, `public.escrows`, `public.appointments`, `public.support_tickets`, `public.audit_logs`).
- **Referential Integrity:** Enforced via foreign key constraints (`ON DELETE CASCADE` on child records).
- **In-Memory Cache vs DB:** Some backend services use synchronous in-memory maps (`otpCache`, `adminMfaSessions`) which reset on server restart.

### 3.3 Geospatial & Map Functionality
- **Coordinate Formats:** Supports GeoJSON `[longitude, latitude]`, Leaflet `[latitude, longitude]`, and `{lat, lng}` objects.
- **Haversine Distance:** Verified accuracy Indiranagar to Whitefield (~11.9 km).
- **PostGIS Extension:** PostGIS is defined in schema (`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"` and `postgis`).

### 3.4 AI Microservice & Recommendation Ranking
- **Scoring Invariant:** Follows exact formula:
  $$S = 0.35 \times \text{Relevance} + 0.25 \times \text{Location} + 0.20 \times \text{Budget} + 0.15 \times \text{Features} + 0.05 \times \text{Quality}$$
- **Data Sanitization:** Strips internal review notes, private title deeds, and raw seller contact details from AI outputs.

### 3.5 Automated Test Baseline
- **Execution Status:** 243 automated tests across 9 test suites passed with 0 failures.
- **Codebase Build:** Frontend Vite production build succeeds with code splitting; all chunks under 540 kB.

