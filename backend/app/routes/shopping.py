import asyncio
import re

from fastapi import APIRouter, HTTPException, Request

from app.agent.agent import run_shopping_graph_async
from app.agent.intent import SUGGESTIONS, is_smalltalk, smalltalk_reply
from app.agent.parser import _PRICE_PATTERNS, _STOP, parse_query
from app.config.settings import settings
from app.models.schema import SearchRequest, SearchResponse
from app.safe_log import safe_for_console
from app.services.rate_limit import rate_limiter

router = APIRouter()


_PRIOR_RATING = 4.0
_PRIOR_WEIGHT = 500
_RELEVANCE_WEIGHT = 0.30
_EARBUD_WORDS = frozenset({"earbud", "earbuds", "earphone", "earphones", "buds"})
_GENERIC_QUERY_WORDS = frozenset(
    {
        "wireless",
        "bluetooth",
        "best",
        "top",
        "good",
        "great",
        "cheap",
        "cheapest",
        "new",
        "latest",
        "premium",
        "budget",
        "affordable",
        "portable",
        "lightweight",
        "quality",
    }
)


def _parse_review_count(value: object) -> int:
    if value is None:
        return 0
    if isinstance(value, int):
        return max(0, value)
    if isinstance(value, float):
        return max(0, int(value))
    try:
        digits = "".join(ch for ch in str(value) if ch.isdigit())
        return int(digits) if digits else 0
    except Exception:
        return 0


def _query_tokens(query: str) -> list[str]:
    """Return meaningful tokens from *query*, stripping budget text and stop-words."""
    q = query
    for pat in _PRICE_PATTERNS:
        q = pat.sub(" ", q)
    tokens_raw = re.findall(r"[a-z0-9]+", q.lower())
    _CURRENCY_WORDS = {"dollar", "dollars", "usd", "bucks"}
    seen: set[str] = set()
    result: list[str] = []
    for tok in tokens_raw:
        if tok in _STOP:
            continue
        if tok in _CURRENCY_WORDS:
            continue
        if len(tok) < 2:
            continue
        if tok not in seen:
            seen.add(tok)
            result.append(tok)
    filtered = [
        tok
        for tok in result
        if any(ch.isdigit() for ch in tok) or tok not in _GENERIC_QUERY_WORDS
    ]
    return filtered if filtered else result


def _relevance(title: str, tokens: list[str]) -> float | None:
    """Return 0.0–1.0 match fraction, or None when *tokens* is empty."""
    if not tokens:
        return None
    title_set = set(re.findall(r"[a-z0-9]+", title.lower()))
    total_weight = 0.0
    matched_weight = 0.0
    for tok in tokens:
        weight = 2.0 if any(ch.isdigit() for ch in tok) else 1.0
        total_weight += weight
        if tok in title_set:
            matched_weight += weight
    if total_weight == 0.0:
        return None
    rel = matched_weight / total_weight
    if not any(t in _EARBUD_WORDS for t in tokens) and any(t in _EARBUD_WORDS for t in title_set):
        rel *= 0.4
    return rel


def _score_product(p: dict, tokens: list[str]) -> float:
    price = p.get("price")
    rating = p.get("rating")
    if isinstance(rating, (int, float)):
        v = _parse_review_count(p.get("reviews"))
        R = float(rating)
        C = _PRIOR_RATING
        m = _PRIOR_WEIGHT
        adjusted = (v * R + m * C) / (v + m)
        rating_score = adjusted * 20
    else:
        rating_score = 50
    price_score = 60
    if isinstance(price, (int, float)) and price > 0:
        price_score = max(0.0, 100.0 - min(float(price) / 20.0, 100.0))
    base = (rating_score * 0.55) + (price_score * 0.45)
    rel = _relevance(str(p.get("name", "")), tokens)
    if rel is None:
        return base
    return base * (1 - _RELEVANCE_WEIGHT) + (rel * 100) * _RELEVANCE_WEIGHT


def _build_markdown_result(
    products: list[dict],
    best_choice: dict | None,
    no_data: bool,
    fallback_reason: str = "",
) -> str:
    if no_data:
        return (
            "### 🛒 Product Results\n\n"
            "Currently no reliable data found online.\n\n"
            "---\n\n"
            "### ⭐ Recommendation:\n"
            "Currently no reliable data found online."
        )
    chunks = ["### 🛒 Product Results\n"]
    for idx, p in enumerate(products, start=1):
        chunks.append(
            f"**{idx}. Product Name:** {p.get('name') or 'N/A'}\n"
            f"- Price: {p.get('price') if p.get('price') is not None else 'N/A'}\n"
            f"- Brand: {p.get('brand') or 'N/A'}\n"
            f"- Features: {p.get('features') or 'N/A'}\n"
            f"- Rating: {p.get('rating') if p.get('rating') is not None else 'N/A'}\n"
            f"- Store: {p.get('store') or p.get('source') or 'N/A'}\n"
        )
    if best_choice:
        reason = (
            f"{best_choice.get('name', 'This option')} is selected as BEST CHOICE due to "
            "the strongest features-vs-price balance and available product quality signals."
        )
    elif products:
        reason = (
            fallback_reason
            or "No product found within your budget. Showing the closest options above your budget."
        )
    else:
        reason = "Currently no reliable data found online."
    chunks.append("\n---\n\n### ⭐ Recommendation:\n" + reason)
    return "\n".join(chunks)


@router.post("/shopping/search", response_model=SearchResponse)
async def shopping_search(body: SearchRequest, request: Request) -> SearchResponse:
    # ── Rate-limit check (before the try so 429 is never swallowed) ─
    if settings.RATE_LIMIT_PER_MINUTE > 0:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            client_ip = forwarded.split(",")[0].strip()
        else:
            client_ip = request.client.host if request.client else "unknown"
        allowed, retry_after = rate_limiter.check(
            client_ip, settings.RATE_LIMIT_PER_MINUTE
        )
        if not allowed:
            raise HTTPException(
                status_code=429,
                detail="Too many requests. Please wait a moment and try again.",
                headers={"Retry-After": str(retry_after)},
            )

    try:
        query = body.query.strip()

        # ── Small-talk interception ──────────────────────────────
        if is_smalltalk(query):
            reply = await asyncio.to_thread(smalltalk_reply, query)
            return SearchResponse(
                products=[],
                best_choice=None,
                recommendation=reply,
                message=reply,
                markdown_result="",
                intent="chat",
                suggestions=SUGGESTIONS,
                budget_note="",
            )

        parsed = parse_query(query)
        max_price = parsed.get("max_price")
        price_cap_usd = parsed.get("price_cap_usd")
        budget_note = str(parsed.get("budget_note") or "")
        products = await run_shopping_graph_async(query)
        if not products:
            if budget_note:
                no_res_msg = (
                    f"I couldn't find matching products in your {budget_note} range. "
                    "Try raising your budget or changing the keywords."
                )
            else:
                no_res_msg = (
                    "I couldn't find matching products for that search. "
                    "Try different keywords or a higher budget."
                )
            return SearchResponse(
                products=[],
                best_choice=None,
                recommendation="",
                message=no_res_msg,
                markdown_result="",
                intent="no_results",
                suggestions=SUGGESTIONS,
                budget_note=budget_note,
                keywords=parsed.get("keywords") or [],
            )
        tokens = _query_tokens(query)
        ranked = sorted(products, key=lambda p: _score_product(p, tokens), reverse=True)
        has_budget = (price_cap_usd is not None) or (max_price is not None)
        all_over_budget = bool(ranked) and all(
            p.get("over_budget") is True for p in ranked
        )

        if has_budget and all_over_budget:
            best_choice = None
            if budget_note:
                recommendation = (
                    f"Nothing matched your {budget_note} range. "
                    "Showing the closest options above it."
                )
            else:
                recommendation = (
                    "No product found within your budget. "
                    "Showing the closest options above your budget."
                )
            msg = recommendation
        else:
            valid_products = [p for p in ranked if not p.get("over_budget")]
            if valid_products:
                budget_cap = price_cap_usd
                if isinstance(budget_cap, (int, float)):
                    within_budget = [
                        p
                        for p in valid_products
                        if isinstance(p.get("price"), (int, float))
                        and float(p["price"]) <= float(budget_cap)
                    ]
                    best_choice = within_budget[0] if within_budget else valid_products[0]
                elif isinstance(max_price, (int, float)):
                    within_budget = [
                        p
                        for p in valid_products
                        if isinstance(p.get("price"), (int, float))
                        and float(p["price"]) <= float(max_price)
                    ]
                    best_choice = within_budget[0] if within_budget else valid_products[0]
                else:
                    best_choice = valid_products[0]
            else:
                best_choice = ranked[0]

            recommendation = (
                f"BEST CHOICE: {best_choice.get('name', 'N/A')} - best value for money based on "
                "price-to-features balance and available rating data."
            )
            msg = "Live product intelligence results generated from available online sources."

        shown = ranked[:5]
        if best_choice is not None and best_choice not in shown:
            shown[-1] = best_choice

        return SearchResponse(
            products=shown,
            best_choice=best_choice,
            recommendation=recommendation,
            message=msg,
            markdown_result=_build_markdown_result(
                shown,
                best_choice,
                no_data=False,
                fallback_reason=recommendation if (has_budget and all_over_budget) else "",
            ),
            intent="shopping",
            budget_note=budget_note,
            keywords=parsed.get("keywords") or [],
        )
    except HTTPException:
        raise
    except Exception as e:
        print("[shopping_search] error:", safe_for_console(e))
        return SearchResponse(
            products=[],
            best_choice=None,
            recommendation="",
            message="Something went wrong while searching. Please try again.",
            markdown_result="",
            intent="error",
            suggestions=SUGGESTIONS,
            budget_note="",
        )

