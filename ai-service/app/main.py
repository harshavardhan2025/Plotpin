from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .api.recommendations import router as recommendations_router
from .config import settings

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="FastAPI service for Property Marketplace AI Ranking & Semantic Matching",
    version="1.0.0"
)

import os

# Dynamic CORS configuration supporting environment domains for production deployment
DEFAULT_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:5000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5000"
]

env_origins = os.getenv("CORS_ORIGINS", "").split(",")
frontend_env = os.getenv("FRONTEND_URL")
backend_env = os.getenv("BACKEND_URL")

ALLOWED_ORIGINS = list(set(
    DEFAULT_ORIGINS + 
    [o.strip() for o in env_origins if o.strip()] +
    ([frontend_env.strip()] if frontend_env and frontend_env.strip() else []) +
    ([backend_env.strip()] if backend_env and backend_env.strip() else [])
))

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(recommendations_router)

@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "property-marketplace-ai",
        "environment": settings.ENVIRONMENT
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=settings.PORT, reload=True)
