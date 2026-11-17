# Property Marketplace — System Architecture

## 1. High-Level Overview
Property Marketplace is a full-stack real-estate platform engineered for verified, trust-first property transactions. A single registered user can seamlessly search/buy/rent as a buyer AND create/manage/list properties as a seller using one unified account. Administrative operations (verification, document audit, publication, listing suspension) are strictly isolated with server-side authorization.

```
┌────────────────────────────────────────────────────────┐
│                   React + Vite Frontend                │
│    Public Site  ·  User Dashboard  ·  Admin Portal     │
└───────────────────────────┬────────────────────────────┘
                            │ HTTPS / REST / WSS
┌───────────────────────────▼────────────────────────────┐
│                  Node.js + Express API                 │
│  Auth (JWT/OTP) · RBAC · Verification Engine · Storage │
└───┬───────────────────────┬────────────────────────┬───┘
    │                       │                        │
┌───▼──────────────┐  ┌─────▼──────────────┐  ┌──────▼─────────────┐
│  MongoDB Atlas   │  │  Supabase Storage  │  │  Python + FastAPI  │
│ Geospatial Data  │  │  Private Documents │  │  Hybrid AI Ranking │
└──────────────────┘  └────────────────────┘  └────────────────────┘
```

## 2. Key Architectural Decisions
1. **One Account, Multiple Roles**: A user account has unified access for both buying and selling. Switching between Buyer Mode and Seller Mode does not require creating a secondary profile or separate credentials.
2. **Server-Enforced Admin Privilege**: Admin status is assigned strictly server-side through protected administrative escalation. Self-registration as admin is forbidden.
3. **Decoupled Verification vs. Publication**:
   - `verificationStatus`: `draft` | `submitted` | `pending_review` | `needs_changes` | `approved` | `rejected`
   - `publicationStatus`: `unpublished` | `published` | `suspended`
   Properties can only be published once verified and approved by staff.
4. **Isolated AI Microservice**: FastAPI computes semantic relevance and hybrid score ranking $S = 0.35R + 0.25L + 0.20B + 0.15F + 0.05Q$. Express pre-authorizes and filters properties before sending them to the AI service.
5. **Private Document Storage**: Identity documents and property title papers (e-Khata, 7/12, Encumbrance Certificates) are stored in private buckets and accessed only via short-lived signed URLs.
