from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config.settings import settings
from app.routes.shopping import router as shopping_router

_LOCAL_ORIGINS = [
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

_extra_origins = [
    origin.rstrip("/")
    for raw in settings.CORS_ORIGINS.split(",")
    if (origin := raw.strip())
]

allowed_origins = _LOCAL_ORIGINS + _extra_origins

app = FastAPI(
    title="AI Shopping Agent",
    version="1.0.0",
    description="Shopping search with MongoDB → RapidAPI → Playwright → dummy fallback.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(shopping_router, prefix="/api")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
