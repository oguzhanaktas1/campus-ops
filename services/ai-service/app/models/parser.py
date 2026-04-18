from pydantic import BaseModel, Field


class RequestParseRequest(BaseModel):
    text: str = Field(min_length=3, max_length=6000)
    portal: str | None = None
    request_type_candidates: list[str] = Field(default_factory=list)


class RequestParseResponse(BaseModel):
    request_type: str = Field(alias="requestType")
    title: str
    summary: str
    extracted_fields: dict[str, str | int | float | bool | None] = Field(
        default_factory=dict,
        alias="extractedFields",
    )
    missing_fields: list[str] = Field(default_factory=list, alias="missingFields")
    confidence: float = Field(ge=0.0, le=1.0)
    fallback_used: bool = Field(default=False, alias="fallbackUsed")
