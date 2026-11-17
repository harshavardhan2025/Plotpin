# LandPin Real Estate Marketplace — Existing Features Inventory

This document catalogues all functional capabilities implemented across the LandPin platform that must remain preserved and operational throughout all phases.

---

## 1. Citizen & User Experience

### 1.1 Discovery & Search (`/explore`)
- **Multi-Category Filter:** Flats & Apartments, Houses & Villas, Plots & Land, PG & Hostels, Commercial & Shops, Farmland.
- **Transaction Purpose:** Direct Buy (0% Fee) vs. Direct Rent.
- **BHK Selector:** All, 1 BHK, 2 BHK, 3 BHK, 4+ BHK.
- **Dynamic Sorting:** Relevance / Featured, Nearest (Haversine KM), Newest First, Price (Low to High), Price (High to Low).
- **Proximity Search:** User location selection with customizable radius (10 km to 300 km).
- **Owner Exclusion:** A logged-in seller is strictly excluded from seeing their own listings in public discovery feeds.

### 1.2 Interactive Map Engine (`/map`)
- **2D Cadastral Map:** Leaflet map with custom LandPin SVG pins and coordinate clustering.
- **3D Spatial Elevation:** Three.js procedural WebGL grid rendering 3D villa elevations.
- **Map-List Synchronization:** Clicking a card pans the map to coordinates; clicking a map marker highlights the property details.

### 1.3 AI Smart Matching Engine (`/ai`)
- **Natural Language Query Matching:** Matches user text prompt against listing descriptions using embeddings.
- **Weighted Multi-Criteria Ranking:** Combines semantic relevance, location distance, budget compliance, features, and quality scores.
- **Factual Explanations:** Only verified listings receive RERA and Cadastral statements.

### 1.4 Dedicated Property Details (`/properties/:id`)
- Deep-linkable property page with high-resolution image carousel.
- Specifications bar (Area, Property Type, BHK, Price per sq.ft).
- Official Cadastral Audit certificate viewer.
- Action triggers: Call Mediator, Book Surveyor Escort, Initiate Token Escrow, Launch 3D Elevation Tour.

### 1.5 Seller Dashboard (`/portfolio/my-listings`)
- Listing lifecycle tracking: `Draft`, `Pending Review`, `Verified & Live`, `Revision Required`, `Deal Closed / Sold`.
- In-place revision submission (generates comparison diff for admin approval).
- Deal closure action: `Mark as Sold` (archives listing and moves to closed state).

### 1.6 Buyer Portfolio (`/portfolio/my-buyings`)
- Registry of citizen purchases and closed transactions.
- Downloadable BBMP A-Khata certificates and registered cadastral title deeds.
- Total capital deployed metric across verified assets.

### 1.7 Site Visits & Surveyor Escorts (`/visits`)
- Monthly interactive calendar view and chronological list view.
- 60-minute time slot bookings escorted by licensed surveyors.
- Concurrency protection preventing double-booking of identical slots.
- Reschedule visit modal and cancellation with slot release.

### 1.8 Support & Mediation Grievances (`/support`)
- Gated dispute helpdesk: strictly requires owning a listing or having a purchased deed.
- Mandatory asset selection dropdown binding each ticket to a verified property.
- Two-way administrative message reply threads.

---

## 2. Regional Administrator Workspace (`/admin/*`)

- **Secure Login (`/admin/login`):** Independent two-step MFA login requiring administrator password and 6-digit OTP.
- **Top KPI Metrics Bar:** Pending Review, Approved, Published, Mediation Calls, Active Escrows, Support Tickets.
- **Verification Queue (`/admin/verifications`):**
  - Side-by-side diff comparing Current Approved Version vs Proposed Updated Version.
  - One-click Approve, Reject with Formal Findings, or Request Changes.
- **Mediation Center (`/admin/mediation`):** Supervised buyer-owner conference mediation requests and surveyor dispatch.
- **Escrow Settlement Dashboard (`/admin/escrows`):** Earnest money deposit vault tracking, authorized fund release, and vault freeze for disputed parcels.
- **Inventory Management (`/admin/inventory`):** Platform-wide listing overview with unpublish and delist controls.
- **System Audit Logs (`/admin/audit`):** Immutable event log recording timestamps, actions, actors, and findings.

---

## 3. Specialized Modals & Interactive Systems

- `PropertyDetailModal.jsx`: Modal property inspector.
- `PropertyViewer3DModal.jsx`: Three.js 3D walkthrough with camera presets.
- `DeedViewerModal.jsx`: Karnataka Cadastral Title Certificate, BBMP A-Khata seal, and 4-boundary demarcation viewer.
- `EscrowModal.jsx`: Token escrow advance deposit flow.
- `CreatePropertyModal.jsx`: Multi-step listing wizard with title deed upload and coordinate picker.
- `PropertyComparisonModal.jsx`: Equal-category side-by-side comparison of up to 3 properties.
- `LocationPickerModal.jsx`: Map-based pin dropper with OpenStreetMap Nominatim reverse geocoding.
- `AuthModal.jsx`: Citizen phone/email login, OTP verification, and password recovery.
- `UserProfileModal.jsx`: Citizen profile editor, avatar, and preferences.

