from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class LocationCoords(BaseModel):
    latitude: float
    longitude: float

class PropertyLocation(BaseModel):
    address: Optional[str] = ""
    locality: Optional[str] = ""
    city: Optional[str] = ""
    state: Optional[str] = ""
    pincode: Optional[str] = ""
    coordinates: Optional[List[float]] = None # [longitude, latitude]

class CandidateProperty(BaseModel):
    id: str
    title: str
    description: Optional[str] = ""
    category: str  # residential, commercial, land
    propertyType: str  # flat, house, villa, plot, pg
    purpose: str  # sale, rent
    price: float
    bedrooms: Optional[int] = 0
    bathrooms: Optional[int] = 0
    areaSqFt: Optional[float] = 0.0
    amenities: List[str] = Field(default_factory=list)
    location: PropertyLocation
    verificationStatus: str = "approved"
    publicationStatus: str = "published"
    availabilityStatus: Optional[str] = "available"
    cadastralVerified: bool = True
    imagesCount: int = 1

class UserPreferences(BaseModel):
    bedrooms: Optional[int] = None
    amenities: List[str] = Field(default_factory=list)
    minAreaSqFt: Optional[float] = None
    propertyTypes: List[str] = Field(default_factory=list)

class RankingRequest(BaseModel):
    purpose: str = "sale"
    category: Optional[str] = None
    propertyType: Optional[str] = None
    budgetMax: Optional[float] = None
    budgetMin: Optional[float] = None
    searchLocation: Optional[LocationCoords] = None
    radiusKm: Optional[float] = 10.0
    queryText: Optional[str] = ""
    preferences: Optional[UserPreferences] = Field(default_factory=UserPreferences)
    candidates: List[CandidateProperty] = Field(default_factory=list)

class ScoreBreakdown(BaseModel):
    semanticScore: float
    locationScore: float
    budgetScore: float
    featureScore: float
    qualityScore: float
    finalScore: float

class RankedProperty(BaseModel):
    propertyId: str
    property: CandidateProperty
    score: float
    scoreBreakdown: ScoreBreakdown
    explanation: List[str]

class RankingResponse(BaseModel):
    totalCandidates: int
    rankedCount: int
    results: List[RankedProperty]

class SemanticSearchRequest(BaseModel):
    query: str
    candidates: List[CandidateProperty]
    topK: Optional[int] = 10

class SemanticSearchResponse(BaseModel):
    query: str
    matchedProperties: List[RankedProperty]
