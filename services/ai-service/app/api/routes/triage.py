from fastapi import APIRouter, Depends

from app.core.security import verify_internal_api_key
from app.models.triage import TicketTriageRequest, TicketTriageResponse
from app.services.triage_service import TriageService


router = APIRouter(prefix="/triage", tags=["triage"], dependencies=[Depends(verify_internal_api_key)])


@router.post("/ticket", response_model=TicketTriageResponse)
async def triage_ticket(payload: TicketTriageRequest) -> TicketTriageResponse:
    service = TriageService()
    return await service.triage_ticket(payload)
