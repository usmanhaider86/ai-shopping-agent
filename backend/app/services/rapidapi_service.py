import copy
import math
import re
import threading
import time
from typing import Any

import requests

from app.config.settings import settings
from app.safe_log import safe_for_console
from app.services.cache import TTLCache

_RATE_LIMIT_COOLDOWN_SECONDS = 300
_limited_until = 0.0
_lock = threading.Lock()


def is_rate_limited() -> bool:
    with _lock:
        return time.monotonic() < _limited_until


def mark_rate_limited() -> None:
    global _limited_until
    with _lock:
        _limited_until = time.monotonic() + _RATE_LIMIT_COOLDOWN_SECONDS


_cache = TTLCache(
    ttl_seconds=settings.CACHE_TTL_SECONDS,
    max_entries=settings.CACHE_MAX_ENTRIES,
)


def _parse_price(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        n = float(value)
        return n if n > 0 else None
    s = str(value).strip()
    if not s:
        return None
    # Prefer last plausible money token (handles "List: $400 Sale: $299")
    cleaned = s.replace(",", "")
    nums = re.findall(r"\d+(?:\.\d+)?", cleaned)
    if not nums:
        return None
    for token in reversed(nums):
        try:
            n = float(token)
            if n > 0:
                return n
        except ValueError:
            continue
    return None


def _pick_str(d: dict[str, Any], *keys: str) -> str:
    for k in keys:
        v = d.get(k)
        if isinstance(v, str) and v.strip():
            return v.strip()
    return ""


def search_products_rapidapi(
    keywords: list[str],
    limit: int = 5,
    category: str | None = None,
    min_price: float | None = None,
    max_price: float | None = None,
) -> list[dict[str, Any]]:
    if not settings.RAPIDAPI_KEY:
        print("[RapidAPI] skipped: no RAPIDAPI_KEY")
        return []

    # ── Cache lookup ──────────────────────────────────────────────
    cache_key = "|".join([
        " ".join(kw.strip().lower() for kw in keywords),
        (category or "").lower(),
        str(limit),
        str(int(min_price)) if min_price is not None else "None",
        str(math.ceil(max_price)) if max_price is not None else "None",
    ])
    cached = _cache.get(cache_key)
    if cached is not None:
        print("[RapidAPI] cache hit")
        return copy.deepcopy(cached)

    if is_rate_limited():
        print("[RapidAPI] skipped: quota cooldown")
        return []

    q = " ".join(keywords).strip() or "electronics"
    if (category or "").lower() == "smartphone" and "phone" not in q.lower():
        q = f"smartphone {q}".strip()
    url = "https://real-time-amazon-data.p.rapidapi.com/search"
    headers = {
        "X-RapidAPI-Key": settings.RAPIDAPI_KEY,
        "X-RapidAPI-Host": settings.RAPIDAPI_HOST,
    }
    params = {
        "query": q[:200],
        "page": "1",
        "country": "US",
        "sort_by": "RELEVANCE",
        "product_condition": "ALL",
    }
    if min_price is not None:
        params["min_price"] = str(int(min_price))
    if max_price is not None:
        params["max_price"] = str(int(math.ceil(max_price)))
    print("[RapidAPI] price range:", min_price, max_price)
    try:
        r = requests.get(url, headers=headers, params=params, timeout=8)
        print("[RapidAPI] status:", r.status_code)
        headers_obj = getattr(r, "headers", None)
        if headers_obj and hasattr(headers_obj, "items"):
            for k, v in headers_obj.items():
                if str(k).lower() == "x-ratelimit-requests-remaining":
                    print(f"[RapidAPI] quota remaining: {v}")
                    break
        if r.status_code == 429:
            mark_rate_limited()
            print("[RapidAPI] quota exhausted or rate limited; pausing requests for 5 minutes")
            return []
        r.raise_for_status()
        data = r.json()
    except Exception as e:
        print("[RapidAPI] error:", safe_for_console(e))
        return []

    products_raw: list[Any] = []
    if isinstance(data, dict):
        inner = data.get("data") or data
        if isinstance(inner, dict):
            products_raw = inner.get("products") or inner.get("items") or []
        elif isinstance(inner, list):
            products_raw = inner
    if not isinstance(products_raw, list):
        return []

    out: list[dict[str, Any]] = []
    for p in products_raw[:limit]:
        if not isinstance(p, dict):
            continue
        name = _pick_str(
            p,
            "product_title",
            "title",
            "name",
            "product_name",
        )
        link = _pick_str(
            p,
            "product_url",
            "url",
            "link",
            "product_detail_page_url",
        )
        price: float | None = None
        for raw in (
            p.get("product_price"),
            p.get("price"),
            p.get("app_sale_price"),
            p.get("product_minimum_offer_price"),
            p.get("product_price_max") or p.get("product_price_min"),
            p.get("list_price"),
            p.get("sale_price"),
        ):
            price = _parse_price(raw)
            if price is not None:
                break
        brand = _pick_str(p, "product_brand", "brand", "manufacturer")
        photo = _pick_str(
            p,
            "product_photo",
            "product_image",
            "product_main_image_url",
            "image",
            "thumbnail",
            "thumbnail_url",
        )
        features = _pick_str(p, "product_description", "description", "about_product")
        availability = _pick_str(
            p, "product_availability", "availability", "stock_status", "is_available"
        )
        if not name:
            continue
        out.append(
            {
                "name": name[:500],
                "price": price,
                "brand": brand,
                "product_price": p.get("product_price"),
                "product_original_price": p.get("product_original_price"),
                "app_sale_price": p.get("app_sale_price"),
                "product_minimum_offer_price": p.get("product_minimum_offer_price"),
                "list_price": p.get("list_price"),
                "product_star_rating": p.get("product_star_rating"),
                "product_num_ratings": p.get("product_num_ratings"),
                "product_photo": photo,
                "features": features[:1200] if features else "",
                "availability": availability,
                "category": str(p.get("category") or p.get("category_name") or "general")[
                    :120
                ],
                "source": "rapidapi",
                "store": "Amazon",
                "link": link or "https://www.amazon.com",
            }
        )
    print("[RapidAPI] parsed count:", len(out))
    if out:
        _cache.set(cache_key, copy.deepcopy(out))
    return out
