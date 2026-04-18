from typing import Literal

from pydantic import BaseModel, Field


AnalyticsDomain = Literal["IT", "ADMIN"]


class AnalyticsSummaryRequest(BaseModel):
    domain: AnalyticsDomain
    kpis: dict[str, float | int | str | None] = Field(default_factory=dict)
    chart_data: dict[str, object] = Field(default_factory=dict, alias="chartData")
    trend_deltas: dict[str, float | int] = Field(default_factory=dict, alias="trendDeltas")
    grouped_counts: dict[str, int] = Field(default_factory=dict, alias="groupedCounts")


class AnalyticsSummaryResponse(BaseModel):
    summary: str
    highlights: list[str] = Field(default_factory=list)
    confidence: float = Field(ge=0.0, le=1.0)
    fallback_used: bool = Field(default=False, alias="fallbackUsed")
