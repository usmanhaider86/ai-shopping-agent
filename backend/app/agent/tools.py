from typing import Any

from app.db import mongodb
from app.services import rapidapi_service, scraper


def tool_search_mongo(
    keywords: list[str],
    max_price: float | None,
    raw_query: str = "",
    limit: int = 5,
) -> list[dict[str, Any]]:
    return mongodb.search_products(
        keywords, max_price, raw_query=raw_query, limit=limit
    )


def tool_search_rapidapi(
    keywords: list[str],
    limit: int = 5,
    category: str | None = None,
    min_price: float | None = None,
    max_price: float | None = None,
) -> list[dict[str, Any]]:
    return rapidapi_service.search_products_rapidapi(
        keywords,
        limit=limit,
        category=category,
        min_price=min_price,
        max_price=max_price,
    )


def tool_scrape(keywords: list[str], limit: int = 5) -> list[dict[str, Any]]:
    return scraper.scrape_products(keywords, limit=limit)
