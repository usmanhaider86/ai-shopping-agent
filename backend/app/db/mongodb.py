import re
from typing import Any

from pymongo import MongoClient
from pymongo.errors import PyMongoError

from app.config.settings import settings
from app.safe_log import safe_for_console


def _build_name_filter(keywords: list[str]) -> dict[str, Any]:
    cleaned = [k.strip() for k in keywords if k and len(k.strip()) > 1]
    if not cleaned:
        return {}
    return {
        "$and": [
            {"name": {"$regex": re.escape(k), "$options": "i"}} for k in cleaned
        ]
    }


def search_products(
    keywords: list[str],
    max_price: float | None,
    raw_query: str = "",
    limit: int = 5,
) -> list[dict[str, Any]]:
    name_filter = _build_name_filter(keywords)
    if not name_filter and raw_query.strip():
        snippet = " ".join(raw_query.split())[:120]
        name_filter = {"name": {"$regex": re.escape(snippet), "$options": "i"}}
    query_filter: dict[str, Any] = {}
    if name_filter:
        query_filter.update(name_filter)
    if max_price is not None:
        query_filter["price"] = {"$lte": float(max_price)}

    if not query_filter:
        return []

    try:
        client = MongoClient(
            settings.MONGODB_URI, serverSelectionTimeoutMS=2500
        )
        client.admin.command("ping")
        col = client[settings.MONGODB_DB][settings.MONGODB_COLLECTION]
        cursor = (
            col.find(query_filter, {"_id": 0})
            .sort("price", 1)
            .limit(limit)
        )
        out: list[dict[str, Any]] = []
        for doc in cursor:
            doc.setdefault("source", "mongodb")
            out.append(doc)
        client.close()
        return out
    except PyMongoError as e:
        print("[MongoDB] error:", safe_for_console(e))
        return []
    except Exception as e:
        print("[MongoDB] unexpected:", safe_for_console(e))
        return []
