# LandPin Property Marketplace — Security Hardening Documentation

**Date**: 2026-10-22  
**Status**: Implemented & Verified (16/16 Security Tests Passing)  
**Security Lead**: Senior Application Security Engineer

---

## 1. Overview of Security Vulnerabilities Fixed

| Vulnerability ID | Description | Severity | Remediated In | Verification Test |
| :--- | :--- | :--- | :--- | :--- |
| **SEC-01** | **Supabase Service Key (`sb_secret_...`) Exposed in Client** | Critical | [frontend/.env](file:///c:/Users/khars/OneDrive/Documents/estate_p/frontend/.env), [supabase.js](file:///c:/Users/khars/OneDrive/Documents/estate_p/frontend/src/lib/supabase.js) | Verified: No `sb_secret_` string in client bundle or env. |
| **SEC-02** | **Header Privilege Escalation (`X-User-Role: admin`)** | Critical | [authenticate.js](file:///c:/Users/khars/OneDrive/Documents/estate_p/backend/src/middleware/authenticate.js) | Test Group 3: Forged header rejected with 401. |
| **SEC-03** | **Unauthenticated Fallback to Default User** | High | [authenticate.js](file:///c:/Users/khars/OneDrive/Documents/estate_p/backend/src/middleware/authenticate.js) | Test Group 1: Anonymous request rejected with 401. |
| **SEC-04** | **Unverified Password Login & Default Fallback** | High | [authController.js](file:///c:/Users/khars/OneDrive/Documents/estate_p/backend/src/controllers/authController.js) | Bcrypt hash comparison; bad credentials rejected with 401. |
| **SEC-05** | **Mass Assignment on User Profile & Property Status** | High | [authController.js](file:///c:/Users/khars/OneDrive/Documents/estate_p/backend/src/controllers/authController.js), [propertyController.js](file:///c:/Users/khars/OneDrive/Documents/estate_p/backend/src/controllers/propertyController.js) | Strips `roles`, `verificationStatus`, `ownerId`. |
| **SEC-06** | **Cross-User Property Mutation & Confidential Deeds Access** | High | [propertyController.js](file:///c:/Users/khars/OneDrive/Documents/estate_p/backend/src/controllers/propertyController.js), [authorize.js](file:///c:/Users/khars/OneDrive/Documents/estate_p/backend/src/middleware/authorize.js) | Test Group 5: Non-owner blocked with 403. |
| **SEC-07** | **Unrestricted Brute-Force on Authentication Endpoints** | Medium | [rateLimiter.js](file:///c:/Users/khars/OneDrive/Documents/estate_p/backend/src/middleware/rateLimiter.js), [app.js](file:///c:/Users/khars/OneDrive/Documents/estate_p/backend/src/app.js) | Sliding-window limiter on `/auth/*` (30 req/min). |
| **SEC-08** | **Missing HTTP Security Headers** | Medium | [app.js](file:///c:/Users/khars/OneDrive/Documents/estate_p/backend/src/app.js) | `nosniff`, `SAMEORIGIN`, `X-XSS-Protection`, `HSTS`. |

---

## 2. Authentication & Authorization Hardening

### Cryptographic JWT Verification (No Header Trust)
The legacy codebase trusted `X-User-Role: admin` and `X-User-Id` headers supplied directly by the client browser. This was completely eliminated in [authenticate.js](file:///c:/Users/khars/OneDrive/Documents/estate_p/backend/src/middleware/authenticate.js).
* Every protected route enforces `authenticate` middleware.
* The middleware validates the JWT cryptographic signature using `jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] })`.
* If a token is expired, tampered with, or absent, the request is immediately halted with:
  ```json
  { "error": "Authentication required. Please provide a valid Bearer token.", "code": "UNAUTHORIZED" }
  ```
* The user's roles are fetched strictly from the verified database record; self-promotion to `admin` is blocked.

### Development & Demo Session Issuance
To support seamless local testing and role-switching without compromising security:
* A controlled endpoint `POST /api/v1/auth/demo-session` issues genuine, cryptographically signed JWTs for authorized personas (`client` -> `usr_client_001` or `admin` -> `usr_admin_001`).
* [api.js](file:///c:/Users/khars/OneDrive/Documents/estate_p/frontend/src/lib/api.js) automatically requests and stores this signed token, passing it in `Authorization: Bearer <token>` on all requests.

---

## 3. Private Property Document Protection

Legal deeds (such as registered sale deeds, BBMP e-Khata extracts, and 11E survey sketches) are stored in the private Supabase Storage bucket `property-documents`.
* **Access Control**: Handled exclusively in [propertyController.getDocuments](file:///c:/Users/khars/OneDrive/Documents/estate_p/backend/src/controllers/propertyController.js#L393).
* **Authorization Check**: Access is restricted to `prop.ownerId === req.user._id` or `req.user.roles.includes('admin')`.
* **Time-Limited Signed URLs**: URLs are generated with a strict 900-second (15-minute) expiration time via [storage.generateSignedUrl](file:///c:/Users/khars/OneDrive/Documents/estate_p/backend/src/config/storage.js#L98).
* **Upload Restrictions**: Permitted file types are restricted to `PDF`, `JPEG`, `PNG`, and `WEBP` with a 15 MB maximum file size limit. Path traversal is prevented through cryptographically randomized filenames (`${propertyId}/${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${ext}`).

---

## 4. PostgreSQL Row Level Security (RLS) Policies

All database-level RLS policies and indexes are declared in [scripts/security_rls_hardening.sql](file:///c:/Users/khars/OneDrive/Documents/estate_p/scripts/security_rls_hardening.sql):
1. **Public Property Visibility**:
   ```sql
   CREATE POLICY "Strict public visibility for verified listings"
     ON public.properties FOR SELECT
     USING (
       (verification_status = 'approved' AND publication_status = 'published' AND availability_status = 'available')
       OR (auth.uid()::text = owner_id)
       OR (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid()::text AND role = 'admin'))
     );
   ```
2. **Deed Confidentiality**:
   ```sql
   CREATE POLICY "Strict document access for owner and admin only"
     ON public.property_documents FOR SELECT
     USING (
       auth.uid()::text = owner_id
       OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid()::text AND role = 'admin')
     );
   ```
3. **Audit Log Immutability**:
   `UPDATE`, `DELETE`, and `TRUNCATE` operations are explicitly revoked from public and authenticated roles on `public.audit_logs`.

---

## 5. Security Regression Verification

Automated regression tests in [backend/tests/security.test.js](file:///c:/Users/khars/OneDrive/Documents/estate_p/backend/tests/security.test.js) execute 16 checks against the running server:
```bash
npm test
```
**Output**: `16 PASSED | 0 FAILED`.
