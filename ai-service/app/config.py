import os

class Settings:
    PROJECT_NAME: str = "Property Marketplace AI Recommendation Service"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    AI_SERVICE_SECRET: str = os.getenv("AI_SERVICE_SECRET", "property_marketplace_ai_secret")
    PORT: int = int(os.getenv("PORT", "8000"))
    
    # Blueprint formula:
    # S = 0.35R + 0.25L + 0.20B + 0.15F + 0.05Q
    WEIGHT_SEMANTIC: float = 0.35   # R = Semantic relevance
    WEIGHT_LOCATION: float = 0.25   # L = Location proximity
    WEIGHT_BUDGET: float = 0.20     # B = Budget fit
    WEIGHT_FEATURES: float = 0.15   # F = Feature & amenity match
    WEIGHT_QUALITY: float = 0.05    # Q = Listing quality & verified status

settings = Settings()
