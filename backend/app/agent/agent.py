import asyncio
import html
import re
from typing import Any, TypedDict

from langgraph.graph import END, StateGraph

from app.agent.parser import parse_query
from app.agent.tools import tool_scrape, tool_search_mongo, tool_search_rapidapi
from app.safe_log import safe_for_console


_MAX_DISCOUNT_PERCENT = 70

_COLOR_WORDS: frozenset[str] = frozenset({
    # ── colours / finishes ──────────────────────────────────────────────────
    "black", "white", "blue", "pink", "red", "green", "gold", "silver",
    "gray", "grey", "purple", "orange", "yellow", "beige", "cream",
    "brown", "navy", "teal", "mint", "lavender", "violet", "rose",
    "graphite", "titanium", "bronze", "copper", "ivory", "tan", "khaki",
    "matte", "cloud", "slate", "midnight", "charcoal", "metallic",
    # ── marketing / retailer words (never product identifiers) ──────────────
    "amazon", "exclusive", "edition", "limited", "official",
})


def _family_key(name: str) -> tuple[str, ...] | None:
    """Return a canonical key for a product family by stripping color tokens.

    Returns None when the remaining tokens are too few to merge safely.
    """
    tokens = re.findall(r"[a-z0-9]+", name.lower())
    mapped = ["microphone" if t == "mic" else t for t in tokens]
    remaining = [t for t in mapped if t not in _COLOR_WORDS]
    if len(remaining) < 3:
        return None
    return tuple(sorted(set(remaining)))


def _identifier_tokens(key: tuple[str, ...]) -> frozenset[str]:
    """Return the tokens of the key that contain at least one digit."""
    return frozenset(t for t in key if any(ch.isdigit() for ch in t))


def _first_token(name: str) -> str:
    tokens = re.findall(r"[a-z0-9]+", name.lower())
    return tokens[0] if tokens else ""


class AgentState(TypedDict, total=False):
    query: str
    raw_query: str
    keywords: list[str]
    max_price: float | None
    budget_currency: str | None
    price_cap_usd: float | None
    price_floor_usd: float | None
    product_category: str | None
    products: list[dict[str, Any]]


def _title_matches_smartphone(name: str) -> bool:
    t = (name or "").lower()
    exclude_phrases = (
        "power bank",
        "powerbank",
        "portable charger",
        "battery pack",
        "external battery",
        "wireless charger pad",
        "charging cable",
        "wall charger",
        "usb hub",
        "tempered glass",
        "phone case",
        "screen protector",
        "case for ",
        "cover for ",
        "galaxy buds",
        "airpods",
        "earbuds",
        "smartwatch",
        " watch",
    )
    for phrase in exclude_phrases:
        if phrase in t:
            return False
    if re.search(r"\b(?:[1-9]\d{4,}|[5-9]\d{3})\s*mah\b", t):
        return False
    if re.search(r"\bsmartphone\b", t):
        return True
    include_markers = (
        "iphone",
        "galaxy s",
        "galaxy z",
        "galaxy a",
        "galaxy m",
        "galaxy note",
        "google pixel",
        "pixel ",
        "oneplus",
        "xiaomi",
        "redmi",
        "poco",
        "oppo reno",
        "oppo a",
        "oppo find",
        "vivo ",
        "realme",
        "motorola",
        " nokia ",
        "nothing phone",
        "zenfone",
        "samsung galaxy",
        "sony xperia",
        "unlocked android",
        "android smartphone",
        "cell phone",
        "mobile phone",
    )
    for m in include_markers:
        if m in t:
            return True
    if re.search(r"\bphone\b", t) and "charger" not in t and "power bank" not in t:
        return True
    return False


def _filter_by_category(
    products: list[dict[str, Any]], category: str | None
) -> list[dict[str, Any]]:
    if category != "smartphone":
        return products
    return [p for p in products if _title_matches_smartphone(str(p.get("name", "")))]


def _to_float(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    txt = str(value).strip()
    if not txt:
        return None
    keep = "".join(ch for ch in txt if ch.isdigit() or ch == ".")
    if not keep:
        return None
    try:
        return float(keep)
    except ValueError:
        return None


def _pick_price_value(product: dict[str, Any]) -> float | None:
    """First positive price from known keys (avoids `0 or x` dropping a real 0 sentinel)."""
    for key in (
        "price",
        "product_price",
        "app_sale_price",
        "product_minimum_offer_price",
        "list_price",
        "sale_price",
    ):
        if key not in product:
            continue
        v = product[key]
        if v is None:
            continue
        parsed = _to_float(v)
        if parsed is not None and parsed > 0:
            return parsed
    return None


def _pick_original_price(product: dict[str, Any]) -> float | None:
    for key in ("original_price", "product_original_price"):
        if key not in product:
            continue
        v = product[key]
        if v is None:
            continue
        parsed = _to_float(v)
        if parsed is not None and parsed > 0:
            return parsed
    return None


def _pick_rating_value(product: dict[str, Any]) -> float | None:
    for key in ("rating", "product_star_rating", "star_rating"):
        if key not in product:
            continue
        v = product[key]
        if v is None:
            continue
        parsed = _to_float(v)
        if parsed is not None and parsed >= 0:
            return parsed
    return None


def _pick_reviews_value(product: dict[str, Any]) -> str:
    r = product.get("reviews")
    if r is not None and str(r).strip() and str(r).strip() not in ("N/A", "0"):
        return str(r).strip()[:120]
    for key in ("product_num_ratings", "num_ratings", "review_count"):
        if key not in product:
            continue
        v = product[key]
        if v is None:
            continue
        s = str(v).strip()
        if s and s != "0":
            return s[:120]
    return "N/A"


def _normalize_product(product: dict[str, Any]) -> dict[str, Any]:
    name = str(
        product.get("name")
        or product.get("product_title")
        or product.get("title")
        or "Unknown Product"
    ).strip()
    name = html.unescape(name)

    brand = str(product.get("brand") or product.get("manufacturer") or "").strip() or "N/A"
    brand = html.unescape(brand)

    price_value = _pick_price_value(product)
    original = _pick_original_price(product)
    discount_percent: int | None = None
    above_max_discount = False
    if price_value is not None and original is not None and original > price_value:
        calculated_pct = round((original - price_value) / original * 100)
        if 1 <= calculated_pct <= _MAX_DISCOUNT_PERCENT:
            discount_percent = calculated_pct
        elif calculated_pct > _MAX_DISCOUNT_PERCENT:
            above_max_discount = True
            original = None
        else:
            original = None
    else:
        original = None

    if discount_percent is not None:
        discount = f"{discount_percent}% off"
    elif above_max_discount:
        discount = "N/A"
    else:
        existing_discount = str(product.get("discount") or "").strip()
        discount = existing_discount if existing_discount else "N/A"

    features = product.get("features")
    if isinstance(features, list):
        features_text = ", ".join(str(x).strip() for x in features if str(x).strip()) or "N/A"
    else:
        features_text = str(features or product.get("description") or "N/A").strip() or "N/A"
    features_text = html.unescape(features_text)

    rating = _pick_rating_value(product)
    reviews = _pick_reviews_value(product)
    raw_av = str(product.get("availability") or product.get("stock_status") or "").strip()
    if not raw_av or raw_av.lower() == "unknown":
        availability = ""
    else:
        availability = raw_av[:120]
    store = str(product.get("store") or product.get("source") or "unknown").strip()
    store = html.unescape(store)

    link = str(
        product.get("link")
        or product.get("url")
        or product.get("product_url")
        or ""
    ).strip()
    image = str(
        product.get("image")
        or product.get("image_url")
        or product.get("product_photo")
        or product.get("product_image")
        or product.get("thumbnail")
        or ""
    ).strip()[:1000]
    return {
        "name": name[:500],
        "brand": brand[:120],
        "price": price_value,
        "discount": discount[:120],
        "original_price": original,
        "discount_percent": discount_percent,
        "features": features_text[:1200],
        "rating": rating,
        "reviews": reviews,
        "availability": availability[:120],
        "store": store[:120],
        "source": store[:120],
        "link": link[:1000],
        "image": image,
        "over_budget": False,
    }


def _dedupe(products: list[dict[str, Any]]) -> list[dict[str, Any]]:
    # ── Step 1: exact duplicate removal on (name, link) ──────────────────────
    seen_exact: set[tuple[str, str]] = set()
    exact_deduped: list[dict[str, Any]] = []
    for p in products:
        key = (str(p.get("name", "")).lower(), str(p.get("link", "")).lower())
        if key in seen_exact:
            continue
        seen_exact.add(key)
        exact_deduped.append(p)

    # ── Step 2: colour/variant merging (First pass: exact family key) ─────────
    # Group products by family key; preserve first-appearance order of groups.
    first_pass_groups: list[dict[str, Any]] = []
    seen_keys: dict[tuple[str, ...], dict[str, Any]] = {}

    for p in exact_deduped:
        fk = _family_key(str(p.get("name", "")))
        if fk is None:
            first_pass_groups.append({"key": None, "products": [p]})
        else:
            if fk in seen_keys:
                seen_keys[fk]["products"].append(p)
            else:
                group = {"key": fk, "products": [p]}
                seen_keys[fk] = group
                first_pass_groups.append(group)

    # ── Step 3: second pass variant merging ──────────────────────────────────
    merged_groups: list[dict[str, Any]] = []
    for group_b in first_pass_groups:
        merged = False
        key_b = group_b["key"]
        if key_b is not None:
            id_b = _identifier_tokens(key_b)
            if id_b:
                first_b = _first_token(str(group_b["products"][0].get("name", "")))
                for group_a in merged_groups:
                    key_a = group_a["key"]
                    if key_a is None:
                        continue
                    first_a = _first_token(str(group_a["products"][0].get("name", "")))
                    if first_a != first_b:
                        continue
                    id_a = _identifier_tokens(key_a)
                    if id_a != id_b:
                        continue
                    set_a = set(key_a)
                    set_b = set(key_b)
                    union = set_a | set_b
                    jaccard = (len(set_a & set_b) / len(union)) if union else 0.0
                    if jaccard >= 0.75:
                        group_a["products"].extend(group_b["products"])
                        merged = True
                        break
        if not merged:
            merged_groups.append(group_b)

    # ── Step 4: pick representatives and build output ────────────────────────
    out: list[dict[str, Any]] = []
    for group in merged_groups:
        prods = group["products"]
        if len(prods) == 1:
            prods[0]["variant_count"] = 1
            out.append(prods[0])
        else:
            # Prefer products with a numeric price; among those pick lowest price.
            with_price = [p for p in prods if p.get("price") is not None]
            if with_price:
                best = min(with_price, key=lambda p: float(p["price"]))  # type: ignore[arg-type]
            else:
                best = prods[0]
            best["variant_count"] = len(prods)
            out.append(best)
    return out


def _node_parse(state: AgentState) -> AgentState:
    q = state.get("query") or ""
    parsed = parse_query(q)
    return {
        **state,
        "keywords": list(parsed.get("keywords") or []),
        "max_price": parsed.get("max_price"),
        "budget_currency": parsed.get("currency"),
        "price_cap_usd": parsed.get("price_cap_usd"),
        "price_floor_usd": parsed.get("price_floor_usd"),
        "product_category": parsed.get("category"),
        "raw_query": str(parsed.get("original") or q),
    }


def _node_retrieve(state: AgentState) -> AgentState:
    keywords = state.get("keywords") or []
    max_price = state.get("max_price")
    price_floor_usd = state.get("price_floor_usd")
    price_cap_usd = state.get("price_cap_usd")
    category = state.get("product_category")
    raw_q = state.get("raw_query") or state.get("query") or ""
    cur = (state.get("budget_currency") or "").strip().upper()
    mongo_cap = max_price
    if cur == "USD" and price_cap_usd is not None:
        mongo_cap = price_cap_usd
    products: list[dict[str, Any]] = []
    mongo_hits = tool_search_mongo(keywords, mongo_cap, raw_query=raw_q, limit=8)
    print("[Flow] MongoDB count:", len(mongo_hits))
    products.extend(mongo_hits)
    api_hits = tool_search_rapidapi(
        keywords,
        limit=20,
        category=category,
        min_price=price_floor_usd,
        max_price=price_cap_usd,
    )
    print("[Flow] RapidAPI count:", len(api_hits))
    products.extend(api_hits)
    try:
        scrape_hits = tool_scrape(keywords, limit=8)
    except Exception as e:
        print("[Flow] scraper exception:", safe_for_console(e))
        scrape_hits = []
    print("[Flow] Scraper count:", len(scrape_hits))
    products.extend(scrape_hits)
    normalized = [_normalize_product(p) for p in products if isinstance(p, dict)]
    after_cat = _filter_by_category(normalized, category)
    # If smartphone title filter removes everything, still try pricing on unfiltered rows.
    pool = after_cat if after_cat else normalized

    def apply_price_filter(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
        cap = price_cap_usd
        if cap is not None:
            floor = price_floor_usd if price_floor_usd is not None else 0.0
            return [
                p
                for p in rows
                if p.get("price") is None
                or (float(floor) <= float(p["price"]) <= float(cap))
            ]
        if max_price is not None:
            return [
                p
                for p in rows
                if p.get("price") is None or float(p["price"]) <= float(max_price)
            ]
        return rows

    filtered = apply_price_filter(pool)
    if filtered:
        products = _dedupe(filtered)[:10]
        for p in products:
            p["over_budget"] = False
    elif pool:
        cap_to_check = price_cap_usd if price_cap_usd is not None else max_price
        if cap_to_check is not None:
            above_cap = [
                p
                for p in pool
                if p.get("price") is not None and float(p["price"]) > float(cap_to_check)
            ]
            sorted_above = sorted(
                above_cap,
                key=lambda p: float(p["price"]),
            )
            products = _dedupe(sorted_above)[:10]
            for p in products:
                p["over_budget"] = True
            if products:
                print(
                    "[Flow] budget filter removed all hits; showing closest over-budget options"
                )
            else:
                print(
                    "[Flow] budget filter removed all hits; no over-budget options above cap"
                )
        else:
            products = []
    else:
        print("[Flow] no live rows")
        products = []
    return {**state, "products": products}


def _build_graph():
    g = StateGraph(AgentState)
    g.add_node("parse", _node_parse)
    g.add_node("retrieve", _node_retrieve)
    g.set_entry_point("parse")
    g.add_edge("parse", "retrieve")
    g.add_edge("retrieve", END)
    return g.compile()


_compiled = _build_graph()


def run_shopping_graph(query: str) -> list[dict[str, Any]]:
    out = _compiled.invoke({"query": query})
    return list(out.get("products") or [])[:10]


async def run_shopping_graph_async(query: str) -> list[dict[str, Any]]:
    return await asyncio.to_thread(run_shopping_graph, query)
