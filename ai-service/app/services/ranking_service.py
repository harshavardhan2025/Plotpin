from typing import List
from ..schemas.recommendation import (
    RankingRequest, RankingResponse, RankedProperty, ScoreBreakdown
)
from ..recommenders.filters import apply_hard_filters
from ..recommenders.scoring import (
    compute_location_score, compute_budget_score, compute_feature_score, compute_quality_score
)
from ..recommenders.semantic import compute_semantic_score
from ..config import settings

def rank_candidates(req: RankingRequest) -> RankingResponse:
    # 1. Hard filters
    valid_candidates = apply_hard_filters(req.candidates, req)
    
    ranked_results: List[RankedProperty] = []

    for prop in valid_candidates:
        # R - Semantic Relevance
        R = compute_semantic_score(req.queryText or "", prop.title, prop.description or "", prop.amenities)
        
        # L - Location Proximity
        L, dist_km = compute_location_score(prop, req.searchLocation, req.radiusKm or 10.0)
        
        # B - Budget Fit
        B = compute_budget_score(prop, req)
        
        # F - Feature & Amenity Overlap
        F = compute_feature_score(prop, req)
        
        # Q - Quality & Verification Status
        Q = compute_quality_score(prop)
        
        # Hybrid formula: S = 0.35R + 0.25L + 0.20B + 0.15F + 0.05Q
        final_score = (
            (settings.WEIGHT_SEMANTIC * R) +
            (settings.WEIGHT_LOCATION * L) +
            (settings.WEIGHT_BUDGET * B) +
            (settings.WEIGHT_FEATURES * F) +
            (settings.WEIGHT_QUALITY * Q)
        )
        final_score = round(final_score, 4)

        # Factual Explanations (Blueprint requirement: factual only, no speculative claims)
        explanations = []
        if prop.cadastralVerified:
            explanations.append("✓ Cadastral verification is recorded")
        if req.searchLocation and dist_km is not None and dist_km <= (req.radiusKm or 10.0):
            explanations.append(f"📍 Located {dist_km} km from chosen search location")
        if req.budgetMax and prop.price <= req.budgetMax:
            explanations.append(f"💰 Matches budget limit (₹{prop.price:,.0f})")
        if req.preferences and req.preferences.bedrooms and prop.bedrooms == req.preferences.bedrooms:
            explanations.append(f"🛏️ Exact {prop.bedrooms} BHK configuration match")
        if prop.amenities:
            explanations.append(f"✨ Includes key amenities: {', '.join(prop.amenities[:3])}")

        score_breakdown = ScoreBreakdown(
            semanticScore=R,
            locationScore=L,
            budgetScore=B,
            featureScore=F,
            qualityScore=Q,
            finalScore=final_score
        )

        ranked_results.append(RankedProperty(
            propertyId=prop.id,
            property=prop,
            score=final_score,
            scoreBreakdown=score_breakdown,
            explanation=explanations
        ))

    # Sort descending by final score
    ranked_results.sort(key=lambda x: x.score, reverse=True)

    return RankingResponse(
        totalCandidates=len(req.candidates),
        rankedCount=len(ranked_results),
        results=ranked_results
    )
