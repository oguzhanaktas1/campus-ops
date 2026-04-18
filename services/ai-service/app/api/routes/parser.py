from fastapi import APIRouter, Depends

from app.core.security import verify_internal_api_key
from app.models.parser import RequestParseRequest, RequestParseResponse
from app.services.parser_service import ParserService


router = APIRouter(prefix="/parse", tags=["parser"], dependencies=[Depends(verify_internal_api_key)])


@router.post("/request", response_model=RequestParseResponse)
async def parse_request(payload: RequestParseRequest) -> RequestParseResponse:
    service = ParserService()
    return await service.parse_request(payload)
