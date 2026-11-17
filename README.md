# PlotPin 🏡

> **Authoritative Cadastral Real Estate Discovery, Digital Deal Records & Verification Platform**

PlotPin is a fullstack real estate marketplace and land intelligence platform built specifically for transparent, verified property transactions. It replaces fragmented classifieds and simulated escrows with a unified citizen workflow, cadastral survey verification, interactive 2D/3D GIS visualization, and digital deal records.

---

## 🌟 Key Features

### 1. Unified Citizen Identity & Authentication
- **Single Account, Multiple Capabilities**: A single verified citizen account can discover, save, inspect, buy, or list properties for sale/rent without switching between fragmented portals.
- **Email & Mobile Verification**: Email ownership verified via 6-digit OTP codes with 60-second cooldown protection. 10-digit mobile number uniqueness enforced across database and authentication records.
- **Supabase Auth & Express JWT**: Secure identity lifecycle powered by Supabase Auth with server-validated JWT sessions and role-based access control.

### 2. Cadastral Property Verification Lifecycle
- **Multi-State Platform Review**: Properties progress through a disciplined lifecycle:
  `Draft` ➔ `Submitted` ➔ `Under Review` ➔ `Documents Verified` ➔ `Published` / `Sold` / `Rented`.
- **Land Records & Survey Checks**: Structured metadata capturing Village, Mandal, District, Survey Number, Subdivision, Extent, and RERA registration.
- **Private Document Vault**: Private deeds and title documentation are protected from public exposure and accessible only to verified owners and authorized administrators.

### 3. Owner Listing Isolation (Discovery & Matching)
- **Zero Self-Recommendation**: When a citizen is logged in, their own listed properties are automatically excluded from public search feeds, discovery maps, and AI matching recommendations.
- **Portfolio Management**: Owners manage their listings and track verification status exclusively within their dedicated "My Properties" portfolio.

### 4. Interactive 2D & 3D Spatial Maps
- **2D Cadastral Discovery Map**: Leaflet and OpenStreetMap integration featuring radius-based proximity filtering (10km, 25km, 50km, 100km, or statewide).
- **3D Spatial Property Visualization**: Three.js WebGL visualization for spatial terrain inspection, boundary demarcation, and virtual parcel viewing.

### 5. AI Property Matcher
- **Explainable Affinity Scoring**: Deterministic multi-factor ranking formula:
  $$\text{Match Score} = 0.35R + 0.25L + 0.20B + 0.15F + 0.05Q$$
  where $R$ is Semantic Relevance, $L$ is Location Proximity, $B$ is Budget Fit, $F$ is Feature Alignment, and $Q$ is Quality/Verification Confidence.
- **Python FastAPI Microservice Ready**: Seamlessly integrates with AI microservices while providing a resilient fallback.

### 6. Digital Deal Records & Site Visit Booking
- **Legally Sound Deal Records**: Eliminates simulated financial escrows in favor of transparent digital deal tracking (Offer Submitted ➔ Accepted ➔ Agreement Pending ➔ Registration Pending ➔ Completed).
- **Site Visit Scheduler**: Slot conflict prevention, past-date validation, and automated booking notifications.

### 7. Super Admin Console
- **Executive Switchboard**: Centralized governance dashboard providing real-time telemetry, verification queues, customer support dispute resolution, and immutable audit logging.

---

## 🛠️ Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 18, Vite 5, Tailwind CSS, Lucide Icons, Leaflet, Three.js, jsPDF |
| **Backend API** | Node.js, Express 4, Socket.IO, JSON Web Tokens (HS256), bcryptjs |
| **Database & Auth** | Supabase PostgreSQL, Supabase Auth, Row Level Security |
| **Testing** | Node.js Test Harness (Security Regression & Deployment Readiness Suites) |

---

## 📁 Repository Structure

```text
PlotPin/
├── frontend/                # React 18 SPA (Vite + Tailwind CSS + Three.js + Leaflet)
│   ├── src/
│   │   ├── components/      # UI components (maps, 3D viewers, modals, cards, navigation)
│   │   ├── contexts/        # AuthContext, PropertyContext
│   │   ├── lib/             # API client (with path normalizer), Supabase SDK
│   │   ├── pages/           # Explore, Map, AI Matcher, Admin Console, Portfolio
│   │   ├── App.jsx          # Route hierarchy & layouts
│   │   └── main.jsx         # Client mount
│   ├── .env.example         # Template frontend environment variables
│   ├── vite.config.js       # Vite configuration with reverse proxy & manual chunks
│   └── package.json
│
├── backend/                 # Node.js + Express API + Socket.IO
│   ├── src/
│   │   ├── config/          # Supabase PostgreSQL adapter & storage engine
│   │   ├── controllers/     # Authentication, properties, admin, recommendations
│   │   ├── middleware/      # JWT/Supabase auth, role authorization, rate limiter
│   │   ├── routes/          # Express REST API routes (/api/v1/*)
│   │   ├── services/        # OTP generation, registration recovery, email delivery
│   │   ├── utils/           # Cadastral eligibility, currency parsers, geometry
│   │   ├── app.js           # Express app configuration & middleware
│   │   └── server.js        # Server entry point & WebSocket server
│   ├── assets/              # Property images served locally
│   ├── scripts/             # Database maintenance scripts & SQL schemas
│   │   └── sql/             # PostgreSQL DDL & RLS hardening scripts
│   ├── tests/               # Security regression & deployment readiness test suites
│   ├── .env.example         # Template backend environment variables
│   └── package.json
│
├── ai-service/              # Python FastAPI Microservice (Port 8000)
│   ├── app/
│   │   ├── api/             # REST endpoints for scored recommendations
│   │   ├── recommenders/    # Hard filters, multi-factor scoring, semantic similarity
│   │   ├── schemas/         # Pydantic request/response schemas
│   │   └── main.py          # FastAPI application entrypoint
│   ├── tests/               # AI recommendation test suite
│   ├── requirements.txt     # Python dependencies
│   └── pyproject.toml
│
├── docs/                    # Complete platform documentation & audit logs
│   ├── reports/             # System audit, security, and feature compliance reports
│   ├── architecture.md      # Full architectural overview
│   └── verification-workflow.md
│
├── package.json             # Root monorepo workspace runner (install, build, dev)
└── README.md
```

---

## 🚀 Quick Start Guide

### Prerequisites
- [Node.js](https://nodejs.org/) (v18.0.0 or higher)
- [npm](https://www.npmjs.com/) (v9.0.0 or higher)
- A [Supabase](https://supabase.com/) project (PostgreSQL database & Auth)

### 1. Clone the Repository
```bash
git clone https://github.com/harshavardhan2025/Plotpin.git
cd Plotpin
```

### 2. Configure Environment Variables

#### Backend Configuration
Copy `backend/.env.example` to `backend/.env`:
```bash
cp backend/.env.example backend/.env
```
Fill in your Supabase credentials and JWT secrets:
```env
PORT=5000
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SECRET_KEY=your-supabase-service-role-key
JWT_ACCESS_SECRET=your-strong-random-secret-key-min-32-chars
FRONTEND_URL=http://localhost:5173
```

#### Frontend Configuration
Copy `frontend/.env.example` to `frontend/.env`:
```bash
cp frontend/.env.example frontend/.env
```
```env
VITE_API_URL=http://localhost:5000/api/v1
```

### 3. Install Dependencies
```bash
# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd ../frontend && npm install
cd ..
```

### 4. Run Automated Verification Tests
Run the comprehensive test suites to ensure database connections, authentication invariants, and security policies are 100% operational:
```bash
# Security regression test suite (16 test assertions)
node backend/tests/security.test.js

# Deployment readiness & logic verification suite (16 test assertions)
node backend/tests/deployment-readiness.test.js
```

### 5. Start Development Servers

In terminal 1 (Backend):
```bash
cd backend
npm run dev
# Server running at http://localhost:5000
```

In terminal 2 (Frontend):
```bash
cd frontend
npm run dev
# Vite dev server running at http://localhost:5173
```

---

## 🔒 Security & Data Integrity

- **Strict Privilege Isolation**: Non-owners are prevented from mutating foreign listings or reading private cadastral deeds (HTTP 403 Forbidden).
- **No Hardcoded Secrets**: All cryptographic keys and Supabase credentials are strictly sourced from environment variables; privileged service-role keys are excluded from frontend bundles.
- **SQL / Injection Defense**: Parametrized queries and strict input sanitization on all search queries and budget boundaries.
- **Rate-Limiting**: OTP requests and login endpoints are guarded with sliding-window rate limiters.

---

## 🌐 Deploy to Render

PlotPin is configured for seamless deployment on [Render](https://render.com) using the included [`render.yaml`](render.yaml) Blueprint:

1. Push your changes to GitHub.
2. In your Render Dashboard, click **New +** ➔ **Blueprint**.
3. Select your repository `harshavardhan2025/Plotpin`.
4. Render automatically provisions:
   - **`plotpin-backend`**: Node.js Express REST API & WebSocket service
   - **`plotpin`**: React 18 Static Site with client-side SPA rewrite rules (deployed to https://plotpin.onrender.com)
   - **`plotpin-ai-service`**: Python FastAPI microservice for scored recommendations
5. Provide your Supabase project URL and keys when prompted.

For detailed step-by-step instructions and manual setup options, see [Render Deployment Guide](docs/deployment/render.md).

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
