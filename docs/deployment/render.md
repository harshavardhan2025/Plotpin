# 🚀 Render Deployment Guide for PlotPin

This guide walks you through deploying the complete **PlotPin** platform on [Render](https://render.com) (`frontend`, `backend`, and `ai-service`).

---

## Architecture on Render

| Service | Render Type | Runtime | Build Command | Start Command / Publish Dir | Health Check |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`plotpin-backend`** | Web Service | `Node` | `npm install` | `npm start` | `/api/v1/health` |
| **`plotpin-frontend`** | Static Site | `Static` | `npm install && npm run build` | `dist` | — |
| **`plotpin-ai-service`**| Web Service | `Python` | `pip install -r requirements.txt` | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` | `/health` |

---

## Option 1: Instant Blueprint Deployment (Recommended)

PlotPin includes a production-ready [`render.yaml`](../../render.yaml) at the repository root.

1. Log into your [Render Dashboard](https://dashboard.render.com).
2. Click **New +** ➔ **Blueprint**.
3. Connect your GitHub repository (`harshavardhan2025/Plotpin`).
4. Render will detect `render.yaml` and provision all 3 services automatically.
5. In the configuration prompt, enter your Supabase secrets:
   * `SUPABASE_URL`: `https://<your-project-id>.supabase.co`
   * `SUPABASE_SECRET_KEY`: Your Supabase `service_role` secret key
   * `VITE_SUPABASE_URL`: `https://<your-project-id>.supabase.co`
   * `VITE_SUPABASE_KEY`: Your Supabase `anon` / public client key
6. Click **Apply**. Render will automatically build, interconnect, and deploy all 3 services!

---

## Option 2: Manual Service-by-Service Setup

If you prefer setting up the services individually on Render:

### Step 1: Deploy AI Recommendation Service
1. **New +** ➔ **Web Service**.
2. Connect your repository.
3. Configure:
   * **Name:** `plotpin-ai-service`
   * **Root Directory:** `ai-service`
   * **Runtime:** `Python 3`
   * **Build Command:** `pip install -r requirements.txt`
   * **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. Environment Variables:
   * `ENVIRONMENT`: `production`
   * `AI_SERVICE_SECRET`: *(Any secure random string)*
5. Click **Create Web Service**. Note the deployed URL (e.g. `https://plotpin-ai-service.onrender.com`).

---

### Step 2: Deploy Backend Express API
1. **New +** ➔ **Web Service**.
2. Connect your repository.
3. Configure:
   * **Name:** `plotpin-backend`
   * **Root Directory:** `backend`
   * **Runtime:** `Node`
   * **Build Command:** `npm install`
   * **Start Command:** `npm start`
   * **Health Check Path:** `/api/v1/health`
4. Environment Variables:
   * `NODE_ENV`: `production`
   * `PORT`: `10000`
   * `SUPABASE_URL`: `https://<your-project-id>.supabase.co`
   * `SUPABASE_SECRET_KEY`: `<your-supabase-service-role-key>`
   * `JWT_ACCESS_SECRET`: `<minimum-32-character-random-secret>`
   * `AI_SERVICE_URL`: `https://plotpin-ai-service.onrender.com`
   * `AI_SERVICE_SECRET`: *(Same string used in Step 1)*
   * `FRONTEND_URL`: `https://plotpin-frontend.onrender.com` *(Update after Step 3)*
5. Click **Create Web Service**. Note the deployed URL (e.g. `https://plotpin-backend.onrender.com`).

---

### Step 3: Deploy Frontend React SPA
1. **New +** ➔ **Static Site**.
2. Connect your repository.
3. Configure:
   * **Name:** `plotpin-frontend`
   * **Root Directory:** `frontend`
   * **Build Command:** `npm install && npm run build`
   * **Publish Directory:** `dist`
4. Redirects & Rewrites:
   * Click **Redirects/Rewrites**.
   * Add Rule:
     * **Type:** `Rewrite`
     * **Source:** `/*`
     * **Destination:** `/index.html`
5. Environment Variables:
   * `VITE_API_URL`: `https://plotpin-backend.onrender.com/api/v1`
   * `VITE_SUPABASE_URL`: `https://<your-project-id>.supabase.co`
   * `VITE_SUPABASE_KEY`: `<your-supabase-anon-key>`
6. Click **Create Static Site**.

---

## Verification Checklist After Deployment

- [ ] **Backend Health Check:** Visit `https://plotpin-backend.onrender.com/api/v1/health` ➔ should return `{"status": "ok", "service": "property-marketplace-api"}`.
- [ ] **AI Service Health Check:** Visit `https://plotpin-ai-service.onrender.com/health` ➔ should return `{"status": "ok"}`.
- [ ] **Frontend Application:** Visit `https://plotpin-frontend.onrender.com` ➔ test property search, 3D cadastral viewer, and citizen login.
- [ ] **CORS Verification:** Ensure requests from `plotpin-frontend.onrender.com` are authorized without browser CORS blocks (already automated in `backend/src/app.js`).
