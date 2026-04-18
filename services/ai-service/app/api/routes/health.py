from fastapi import APIRouter

from app.core.config import get_settings


router = APIRouter(tags=["health"])


@router.get("/health")
async def health() -> dict[str, object]:
    settings = get_settings()
    return {
        "status": "ok",
        "service": "campusops-ai-service",
        "model": settings.default_model,
        "provider": settings.runtime_provider,
        "enabled": settings.ai_enabled,
    }
