# Property Verification State Machine & Workflow

## State Transition Matrix

The lifecycle of every property strictly follows a multi-stage verification state machine:

```
[Draft] ─────────► [Submitted] ─────────► [PendingReview]
  ▲                                           │
  │                                           ├──► [Approved] ──► [Published] ──► [UnderOffer] ──► [Sold/Rented]
  │                                           │         │             │
  └───── [NeedsChanges] ◄─────────────────────┘         │             └──► [Suspended]
                                                        ▼
                                                    [Rejected]
```

### 1. States & Meanings
- **`draft`**: Property created by user. Only owner can view and edit. Not publicly discoverable.
- **`submitted`**: Owner completed required fields and submitted for administrative review.
- **`pending_review`**: Assigned to verification desk officer or legal title auditor.
- **`needs_changes`**: Reviewer identified issues (e.g., blurry e-Khata extract, mismatched address). Returned to owner with explicit review notes.
- **`approved`**: Reviewer verified ownership documents, cadastral survey coordinates, and legal title.
- **`rejected`**: Disqualified permanently due to fraud, duplicate listing, or illegal encroachment.
- **`published`**: Approved property marked publicly live by admin. Appears in search results, maps, and AI recommendations.
- **`suspended`**: Temporarily taken off search due to active ownership dispute or user report.
- **`under_offer`**: Formal token deposit or purchase agreement in progress.
- **`sold` / `rented`**: Transaction completed and finalized.

### 2. Guardrails & Security Invariants
1. **Public Invisibility**: A listing where `publicationStatus !== 'published'` or `verificationStatus !== 'approved'` will NEVER be returned in public search queries or recommendation feeds.
2. **Server-Side Verification**: Frontend cannot toggle `verificationStatus` directly; all status changes execute through protected `/admin/properties/:id/*` endpoints with actor audit logging.
3. **Private Document Protection**: Deeds and government identity cards are never stored in public asset buckets. Short-lived signed URLs (15-minute expiration) are generated only after owner or admin JWT validation.
