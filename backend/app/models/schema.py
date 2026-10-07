from typing import Any, Literal

from pydantic import BaseModel, Field


class SearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=500)


class SearchResponse(BaseModel):
    products: list[dict[str, Any]]
    best_choice: dict[str, Any] | None = None
    recommendation: str = ""
    message: str = ""
    markdown_result: str = ""
    intent: Literal["shopping", "chat", "no_results", "unavailable", "error"] = "shopping"
    suggestions: list[str] = Field(default_factory=list)
    budget_note: str = ""
    keywords: list[str] = Field(default_factory=list)

