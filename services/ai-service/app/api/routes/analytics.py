from fastapi import APIRouter, Depends

from app.core.security import verify_internal_api_key
from app.models.analytics import AnalyticsSummaryRequest, AnalyticsSummaryResponse
from app.services.analytics_service import AnalyticsService


router = APIRouter(prefix="/analytics", tags=["analytics"], dependencies=[Depends(verify_internal_api_key)])


@router.post("/summary", response_model=AnalyticsSummaryResponse)
async def analytics_summary(
    payload: AnalyticsSummaryRequest,
) -> AnalyticsSummaryResponse:
    service = AnalyticsService()
    return await service.summarize(payload)
