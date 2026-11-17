# Property Marketplace — REST API Specification

Base URL: `/api/v1`

## 1. Authentication & Profiles
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| POST | `/auth/register` | Register new user (Unified Buyer/Seller) | No |
| POST | `/auth/otp/send` | Dispatch OTP for phone verification | No |
| POST | `/auth/otp/verify` | Verify OTP code | No |
| POST | `/auth/login` | Email/Password or Phone/OTP login | No |
| POST | `/auth/refresh` | Refresh JWT access token | Refresh Token |
| POST | `/auth/logout` | Invalidate active session | Yes |
| GET | `/users/me` | Retrieve profile and role preferences | Yes |
| PATCH | `/users/me` | Update profile and search preferences | Yes |

## 2. Properties & Private Documents
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| GET | `/properties` | Public search (Only approved & published listings) | Optional |
| GET | `/properties/:id` | View published property details | Optional |
| POST | `/properties` | Create new private draft listing | Yes (User) |
| PATCH | `/properties/:id` | Update owned property draft/details | Yes (Owner) |
| POST | `/properties/:id/submit` | Submit listing for admin review | Yes (Owner) |
| POST | `/properties/:id/archive` | Archive own listing | Yes (Owner) |
| POST | `/properties/:id/documents` | Register uploaded document metadata | Yes (Owner) |
| GET | `/properties/:id/documents` | List documents for a property | Yes (Owner/Admin) |
| POST | `/properties/:id/documents/:docId/access-url` | Generate temporary signed URL | Yes (Owner/Admin) |
| GET | `/users/me/properties` | List all properties created by user | Yes (User) |

## 3. Admin & Verification Queue
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| GET | `/admin/overview` | Platform KPIs and verification counters | Yes (Admin) |
| GET | `/admin/properties` | Review queue (pending, under review, flagged) | Yes (Admin) |
| GET | `/admin/properties/:id/review` | Deep inspection of listing & documents | Yes (Admin) |
| POST | `/admin/properties/:id/approve` | Approve verification status | Yes (Admin) |
| POST | `/admin/properties/:id/request-changes` | Send back for correction with review notes | Yes (Admin) |
| POST | `/admin/properties/:id/reject` | Reject listing with justification | Yes (Admin) |
| POST | `/admin/properties/:id/publish` | Set publicationStatus to 'published' | Yes (Admin) |
| POST | `/admin/properties/:id/suspend` | Suspend listing due to dispute/fraud | Yes (Admin) |
| GET | `/admin/users` | List platform users & statuses | Yes (Admin) |
| GET | `/admin/audit-logs` | Retrieve moderation and audit trail | Yes (Admin) |

## 4. Search & AI Recommendations
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| GET | `/search/properties` | Filter by category, purpose, budget, location | Optional |
| GET | `/search/nearby` | Geospatial radius search using coordinates | Optional |
| POST | `/recommendations` | AI Hybrid ranking based on preferences | Optional |
| POST | `/recommendations/events` | Record view, favorite, or inquiry event | Yes |
| POST | `/search/semantic` | Natural language search query | Optional |

## 5. Appointments, Inquiries & Support
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| POST | `/properties/:id/inquiries` | Send direct inquiry to owner | Yes |
| GET | `/users/me/inquiries` | View user inquiries (sent & received) | Yes |
| POST | `/appointments` | Schedule a property visit | Yes |
| GET | `/appointments` | View appointments for user / property | Yes |
| POST | `/appointments/:id/confirm` | Confirm visit appointment | Yes (Owner) |
| POST | `/appointments/:id/cancel` | Cancel visit appointment | Yes |
| POST | `/support/tickets` | Open customer or verification ticket | Yes |
| GET | `/support/tickets` | View support tickets | Yes |
