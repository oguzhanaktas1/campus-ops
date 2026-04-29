from fastapi import APIRouter, Depends

from app.core.security import verify_internal_api_key
from app.models.similar import SimilarTicketRequest, SimilarTicketResponse
from app.services.similar_service import SimilarTicketService


router = APIRouter(prefix="/tickets", tags=["similar"], dependencies=[Depends(verify_internal_api_key)])


@router.post("/similar", response_model=SimilarTicketResponse)
async def find_similar_tickets(payload: SimilarTicketRequest) -> SimilarTicketResponse:
    service = SimilarTicketService()
    return await service.find_similar(payload)
