from fastapi import APIRouter, Depends

from app.core.security import verify_internal_api_key
from app.models.assistant import AssistantAskRequest, AssistantAskResponse
from app.services.assistant_service import AssistantService


router = APIRouter(prefix="/assistant", tags=["assistant"], dependencies=[Depends(verify_internal_api_key)])


@router.post("/ask", response_model=AssistantAskResponse)
async def ask_assistant(payload: AssistantAskRequest) -> AssistantAskResponse:
    service = AssistantService()
    return await service.answer(payload)
