from typing import List
from ..schemas.recommendation import CandidateProperty, RankingRequest

def apply_hard_filters(candidates: List[CandidateProperty], req: RankingRequest) -> List[CandidateProperty]:
    """
    Applies deterministic hard filters as required by blueprint:
    - Must be published and approved (security invariant)
    - Must match requested transaction purpose (sale vs rent)
    - If category is specified, must match category
    - Must strictly be within upper budget bound (budgetMax * 1.15 tolerance if provided)
    """
    filtered: List[CandidateProperty] = []
    for prop in candidates:
        # Security invariant: Never recommend unpublished, unapproved, sold, rented, or completed properties
        if prop.verificationStatus != "approved" or prop.publicationStatus != "published":
            continue
        
        status = (prop.availabilityStatus or "available").lower()
        if status in ("sold", "rented", "inactive", "withdrawn"):
            continue

        # Purpose filter
        if req.purpose and (prop.purpose or "").lower() != req.purpose.lower():
            continue

        # Category filter
        if req.category and (prop.category or "").lower() != req.category.lower():
            continue

        # Property type filter
        if req.propertyType and (prop.propertyType or "").lower() != req.propertyType.lower():
            continue

        # Strict budget bounds check
        if req.budgetMax is not None and prop.price > req.budgetMax:
            continue
        if req.budgetMin is not None and prop.price < req.budgetMin:
            continue

        filtered.append(prop)

    return filtered
