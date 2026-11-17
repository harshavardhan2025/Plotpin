import math
from typing import Tuple, Optional
from ..schemas.recommendation import CandidateProperty, RankingRequest, LocationCoords

def haversine_distance_km(coord1: LocationCoords, coord2: Tuple[float, float]) -> Optional[float]:
    """
    coord1: LocationCoords(latitude, longitude)
    coord2: (longitude, latitude) from GeoJSON [lng, lat]
    Consistent standard formula with R = 6371.0 km
    """
    lon1, lat1 = coord1.longitude, coord1.latitude
    lon2, lat2 = coord2[0], coord2[1]
    
    # Missing / placeholder coordinates must never be silently substituted with fake distance
    if lon2 is None or lat2 is None or (lon2 == 0.0 and lat2 == 0.0):
        return None

    R = 6371.0 # Earth radius in kilometers
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(R * c, 2)

def compute_location_score(prop: CandidateProperty, search_loc: Optional[LocationCoords], radius_km: float) -> Tuple[float, Optional[float]]:
    """Returns (normalized_score, distance_km)"""
    if search_loc is None:
        return 0.75, None
        
    if not prop.location.coordinates or len(prop.location.coordinates) < 2:
        return 0.0, None
    
    dist_km = haversine_distance_km(search_loc, (prop.location.coordinates[0], prop.location.coordinates[1]))
    if dist_km is None:
        return 0.0, None

    if dist_km > radius_km:
        norm = 0.0
    else:
        norm = max(0.0, 1.0 - (dist_km / max(1.0, radius_km)))
    return round(norm, 3), dist_km

def compute_budget_score(prop: CandidateProperty, req: RankingRequest) -> float:
    if not req.budgetMax or req.budgetMax <= 0:
        return 0.85
    
    target = req.budgetMax
    price = prop.price
    if price <= target:
        # Perfectly within budget, slight bonus if closer to optimal range
        ratio = price / target
        return round(0.7 + (0.3 * ratio), 3)
    else:
        # Above budget
        excess_pct = (price - target) / target
        score = max(0.1, 1.0 - (excess_pct * 3.0))
        return round(score, 3)

def compute_feature_score(prop: CandidateProperty, req: RankingRequest) -> float:
    score = 0.5
    
    # 1. Bedroom check
    if req.preferences and req.preferences.bedrooms is not None:
        if prop.bedrooms == req.preferences.bedrooms:
            score += 0.3
        elif prop.bedrooms and abs(prop.bedrooms - req.preferences.bedrooms) == 1:
            score += 0.15

    # 2. Amenity overlap
    if req.preferences and req.preferences.amenities:
        req_amenities = set(a.lower() for a in req.preferences.amenities)
        prop_amenities = set(a.lower() for a in (prop.amenities or []))
        if req_amenities:
            overlap = len(req_amenities.intersection(prop_amenities)) / len(req_amenities)
            score += (overlap * 0.4)

    # 3. Area check
    if req.preferences and req.preferences.minAreaSqFt is not None:
        if prop.areaSqFt and prop.areaSqFt >= req.preferences.minAreaSqFt:
            score += 0.2

    return min(1.0, round(score, 3))

def compute_quality_score(prop: CandidateProperty) -> float:
    q = 0.0
    if prop.cadastralVerified:
        q += 0.45
    if prop.imagesCount >= 3:
        q += 0.30
    elif prop.imagesCount >= 1:
        q += 0.15
    if len(prop.description or "") > 40:
        q += 0.25
    return min(1.0, round(q, 3))
