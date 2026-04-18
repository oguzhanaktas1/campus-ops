from typing import Literal

from pydantic import BaseModel, Field


PriorityLevel = Literal["LOW", "MEDIUM", "HIGH", "URGENT"]


class TicketTriageRequest(BaseModel):
    title: str = Field(min_length=3, max_length=300)
    description: str = Field(min_length=3, max_length=5000)
    requester_faculty: str | None = None
    requester_department: str | None = None
    source_channel: str | None = None
    similar_resolutions: list[str] = Field(default_factory=list)


class TicketTriageResponse(BaseModel):
    request_type: str = Field(default="IT_TICKET", alias="requestType")
    category: str
    priority: PriorityLevel
    suggested_unit: str = Field(alias="suggestedUnit")
    summary: str
    missing_fields: list[str] = Field(default_factory=list, alias="missingFields")
    confidence: float = Field(ge=0.0, le=1.0)
    fallback_used: bool = Field(default=False, alias="fallbackUsed")
