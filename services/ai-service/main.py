from fastapi import FastAPI

from app.api.routes.assistant import router as assistant_router
from app.api.routes.analytics import router as analytics_router
from app.api.routes.health import router as health_router
from app.api.routes.parser import router as parser_router
from app.api.routes.similar import router as similar_router
from app.api.routes.summary import router as summary_router
from app.api.routes.triage import router as triage_router
from app.core.config import get_settings


settings = get_settings()

app = FastAPI(
    title="CampusOps AI Service",
    version="0.1.0",
    docs_url="/docs" if settings.enable_docs else None,
    redoc_url="/redoc" if settings.enable_docs else None,
)

app.include_router(health_router)
app.include_router(triage_router)
app.include_router(parser_router)
app.include_router(summary_router)
app.include_router(assistant_router)
app.include_router(analytics_router)
app.include_router(similar_router)
