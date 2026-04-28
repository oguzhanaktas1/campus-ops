from pydantic import BaseModel, Field


class AssistantLink(BaseModel):
    label: str
    href: str


class AssistantCard(BaseModel):
    type: str
    label: str
    value: str | int | float
    description: str | None = None


class ConversationMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class AssistantAskRequest(BaseModel):
    portal: str
    message: str = Field(min_length=1, max_length=4000)
    main_role: str = Field(alias="mainRole")
    sub_roles: list[str] = Field(default_factory=list, alias="subRoles")
    system_context: str = Field(default="", alias="systemContext")
    portal_context: str = Field(default="", alias="portalContext")
    authorized_routes: list[str] = Field(default_factory=list, alias="authorizedRoutes")
    authorized_route_details: list[dict[str, object]] = Field(
        default_factory=list, alias="authorizedRouteDetails"
    )
    allowed_request_types: list[str] = Field(default_factory=list, alias="allowedRequestTypes")
    visibility_scope: dict[str, object] = Field(default_factory=dict, alias="visibilityScope")
    open_requests: list[dict[str, object]] = Field(default_factory=list, alias="openRequests")
    live_data_context: dict[str, object] = Field(default_factory=dict, alias="liveDataContext")
    conversation_history: list[ConversationMessage] = Field(
        default_factory=list, alias="conversationHistory"
    )


class AssistantAskResponse(BaseModel):
    answer: str
    links: list[AssistantLink] = Field(default_factory=list)
    cards: list[AssistantCard] = Field(default_factory=list)
    confidence: float = Field(ge=0.0, le=1.0)
    fallback_used: bool = Field(default=False, alias="fallbackUsed")
