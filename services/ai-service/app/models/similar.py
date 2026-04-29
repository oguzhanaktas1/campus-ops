from pydantic import BaseModel, Field


class SimilarCandidate(BaseModel):
    id: str
    title: str
    request_no: str
    category: str
    ticket_status: str
    resolution_summary: str | None = None


class SimilarTicketRequest(BaseModel):
    title: str
    description: str
    category: str | None = None
    candidates: list[SimilarCandidate] = Field(default_factory=list)


class SimilarTicketResponse(BaseModel):
    summary: str
    similar_count: int = Field(alias="similarCount")
    highlights: list[str] = Field(default_factory=list)
    confidence: float
    fallback_used: bool = Field(alias="fallbackUsed")

    model_config = {"populate_by_name": True}
