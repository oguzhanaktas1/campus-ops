from fastapi import Header, HTTPException, status

from app.core.config import get_settings


async def verify_internal_api_key(x_ai_service_key: str | None = Header(default=None)) -> None:
    settings = get_settings()
    if x_ai_service_key != settings.internal_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid AI service key.",
        )
