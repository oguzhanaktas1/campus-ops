from fastapi import APIRouter, Depends

from app.core.security import verify_internal_api_key
from app.models.summary import ApprovalSummaryRequest, ApprovalSummaryResponse
from app.services.summary_service import SummaryService


router = APIRouter(prefix="/summary", tags=["summary"], dependencies=[Depends(verify_internal_api_key)])


@router.post("/approval", response_model=ApprovalSummaryResponse)
async def summarize_approval(
    payload: ApprovalSummaryRequest,
) -> ApprovalSummaryResponse:
    service = SummaryService()
    return await service.summarize_approval(payload)
