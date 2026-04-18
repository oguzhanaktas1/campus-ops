from pydantic import BaseModel, Field


class ApprovalSummaryRequest(BaseModel):
    request_title: str = Field(alias="requestTitle")
    request_description: str | None = Field(default=None, alias="requestDescription")
    domain_data: dict[str, object] = Field(default_factory=dict, alias="domainData")
    current_workflow_step: str | None = Field(default=None, alias="currentWorkflowStep")
    previous_actions: list[str] = Field(default_factory=list, alias="previousActions")
    comments_summary: str | None = Field(default=None, alias="commentsSummary")
    attached_documents: list[str] = Field(default_factory=list, alias="attachedDocuments")


class ApprovalSummaryResponse(BaseModel):
    summary: str
    risks: list[str] = Field(default_factory=list)
    recommendations: list[str] = Field(default_factory=list)
    confidence: float = Field(ge=0.0, le=1.0)
    fallback_used: bool = Field(default=False, alias="fallbackUsed")
