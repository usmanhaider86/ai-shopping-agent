import copy
import functools
import json
import re
from typing import Any

from groq import Groq
from langchain_core.prompts import ChatPromptTemplate

from app.config.settings import settings

_UNDER_FLOOR_RATIO = 0.5
_AROUND_LOW_RATIO = 0.8
_AROUND_HIGH_RATIO = 1.2

_USD_HINT = re.compile(r"[\$€£]|\busd\b|\bdollars?\b", re.I)
_PKR_HINT = re.compile(
    r"\b(pkr|pakistani\s*rupee|pk\.?\s*rs|rs\s*pkr|pak\s+rs)\b",
    re.I,
)
_INR_HINT = re.compile(r"\b(inr|₹|indian\s*rupee|lakhs?\b|\blakh\b)", re.I)


_SMARTPHONE_HINT = re.compile(
    r"(?:\bgood\s+battery\s+phone\b|\bbattery\s+phone\b|(?:long\s+)?battery\s+life.*\bphone\b|"
    r"\bsmartphone\b|\biphone\b|\bandroid\s+phone\b|\bmobile\s+phone\b|\bcell\s*phone\b|"
    r"\b(?:unlocked\s+)?(?:android\s+)?smartphone\b|\bgalaxy\s+[sazm0-9]+\b|\bpixel\s+\d\b|"
    r"\boneplus\b|\bredmi\b|\bpoco\b|\boppo\b|\bvivo\b|\brealme\b|\bmotorola\b|\bnokia\b)",
    re.I,
)
from app.safe_log import safe_for_console

_GROQ_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "user",
            'Return ONLY compact JSON: {{"keywords":["word"],"max_price":null,'
            '"currency":"PKR"|"USD"|"INR"|null,"category":"smartphone"|"general"|null}}\n'
            "category=smartphone for phones/mobiles; general for other shopping.\n"
            "Budget: if user gives PKR/rupees use currency PKR; if $/usd use USD.\n"
            "Query: {q}",
        )
    ]
)

_STOP = {
    "find",
    "get",
    "show",
    "search",
    "looking",
    "need",
    "want",
    "buy",
    "cheap",
    "best",
    "please",
    "under",
    "below",
    "above",
    "between",
    "around",
    "less",
    "than",
    "more",
    "the",
    "a",
    "an",
    "for",
    "with",
    "me",
    "my",
    "and",
    "or",
    "to",
    "of",
    "in",
    "on",
    "at",
    "pk",
    "pkr",
    "rs",
    "rupees",
    "rupee",
    "inr",
    "dollar",
    "dollars",
    "usd",
    "bucks",
    "great",
    "good",
    "nice",
}

_PRICE_PATTERNS = [
    re.compile(
        r"(?:under|below|less\s+than|upto|up\s+to|max(?:imum)?|around|about|approximately|approx|roughly)\s*[:\s$€£]*(\d[\d,]*)",
        re.I,
    ),
    re.compile(r"(\d[\d,]*)\s*(?:pkr|pkr|rs\.?|rupees?|inr)\b", re.I),
    re.compile(r"[\$€£]\s*(\d[\d,]*)"),
    re.compile(r"(\d[\d,]*)\s*(?:usd|dollars?|bucks)\b", re.I),
]


def _detect_product_category(query: str) -> str | None:
    """Return 'smartphone' when the user is shopping for a handset (not chargers/power banks)."""
    q = (query or "").strip()
    if not q:
        return None
    ql = q.lower()
    phone_intent = bool(
        _SMARTPHONE_HINT.search(q)
        or re.search(
            r"\b(?:good\s+)?battery\s+phone\b|"
            r"\bphone\s+under\b|\bphones?\s+with\b|"
            r"\bmobile\b|\bhandset\b",
            ql,
        )
    )
    accessory_only = bool(
        re.search(
            r"\b(?:power\s*bank|powerbank|portable\s+charger|external\s+battery|"
            r"battery\s+pack)\b",
            ql,
        )
    ) and not phone_intent
    if accessory_only:
        return None
    if phone_intent:
        return "smartphone"
    if re.search(r"\bphone\b", ql) and not re.search(
        r"\b(?:case|cover|screen\s+protector|tempered\s+glass|charger|cable|adapter)\s+for\b",
        ql,
    ):
        return "smartphone"
    return None


def _infer_budget_currency(query: str, max_price: float | None) -> str | None:
    q = (query or "").strip()
    if not q:
        return None
    if _USD_HINT.search(q):
        return "USD"
    if _PKR_HINT.search(q):
        return "PKR"
    if _INR_HINT.search(q):
        return "INR"
    if max_price is None:
        return None
    if max_price >= 5000:
        return "PKR"
    if max_price < 500:
        return "USD"
    return "USD"


def _budget_to_price_cap_usd(
    max_price: float | None, currency: str | None
) -> float | None:
    """Express the user's budget in USD so it matches Amazon/eBay listing prices."""
    if max_price is None or currency is None:
        return None
    cur = currency.upper()
    if cur == "USD":
        return float(max_price)
    if cur == "PKR":
        rate = settings.PKR_PER_USD or 280.0
        return float(max_price) / rate
    if cur == "INR":
        rate = settings.INR_PER_USD or 83.0
        return float(max_price) / rate
    return None


_KEYWORD_NOISE_SMARTPHONE = frozenset(
    {
        "good",
        "best",
        "nice",
        "need",
        "want",
        "battery",
        "power",
        "bank",
        "please",
        "help",
    }
)


def _refine_keywords_for_category(
    keywords: list[str], category: str | None, raw_query: str
) -> list[str]:
    if category != "smartphone":
        return list(keywords)
    cleaned = [
        k
        for k in keywords
        if k
        and k.lower() not in _KEYWORD_NOISE_SMARTPHONE
        and k.lower() not in ("charging", "charger", "chargers")
    ]
    rq = raw_query.lower()
    kids_intent = any(
        w in rq for w in ("kid", "kids", "child", "children", "toddler", "toy")
    )
    head = [] if kids_intent else ["unlocked", "smartphone"]
    tail = []
    if "fast" in rq or "quick" in rq or "dash" in rq or "warp" in rq:
        tail.extend(["fast", "charging"])
    merged: list[str] = []
    seen: set[str] = set()
    for part in head + cleaned + tail:
        pl = part.lower()
        if pl in seen:
            continue
        seen.add(pl)
        merged.append(part)
    if any("smartphone" in x.lower() for x in merged):
        merged = [x for x in merged if x.lower() != "phone"]
    blob = " ".join(merged).lower()
    if "fast charging" in blob or "fast-charging" in blob:
        merged = [x for x in merged if x.lower() not in ("fast", "charging")]
    return merged[:16] if merged else ["smartphone"]


def _extract_max_price_heuristic(text: str) -> float | None:
    for pat in _PRICE_PATTERNS:
        m = pat.search(text)
        if m:
            raw = m.group(1).replace(",", "")
            try:
                return float(raw)
            except ValueError:
                continue
    return None


def _extract_keywords_heuristic(text: str) -> list[str]:
    # Strip price / budget phrases so their numbers don't become keywords.
    # Use a local copy and replace each price pattern with a delimiter to avoid dangling words.
    scrub_text = text
    for pat in _PRICE_PATTERNS:
        scrub_text = pat.sub(" ; ", scrub_text)
    # Remove non‑word characters and normalize whitespace.
    cleaned = re.sub(r"[^\w\s]", " ", scrub_text.lower())
    parts = [p for p in cleaned.split() if p]
    out: list[str] = []
    for p in parts:
        if p in _STOP:
            continue
        if p.isdigit() and (len(p) < 2 or len(p) > 4):
            continue
        if len(p) < 2:
            continue
        out.append(p)
    # Fallback: if nothing extracted, grab alphabetic tokens from the original text.
    if not out:
        out = [m.group(0).lower() for m in re.finditer(r"[A-Za-z]{2,}", text)]
    return out[:16]


def _sanitize_keywords(keywords: list[str], heuristic_keywords: list[str]) -> list[str]:
    flat_words: list[str] = []
    seen: set[str] = set()
    heuristic_set = {str(hk).lower() for hk in (heuristic_keywords or [])}

    for k in keywords or []:
        s = str(k)
        for pat in _PRICE_PATTERNS:
            s = pat.sub(" ; ", s)
        tokens = re.findall(r"[a-z0-9]+", s.lower())
        for w in tokens:
            if w in _STOP:
                continue
            if w.isdigit():
                if len(w) < 2 or len(w) > 4 or w not in heuristic_set:
                    continue
            if w not in seen:
                seen.add(w)
                flat_words.append(w)

    for hk in heuristic_keywords or []:
        hk_str = str(hk).lower()
        if any(c.isdigit() for c in hk_str):
            if hk_str not in seen:
                seen.add(hk_str)
                flat_words.append(hk_str)

    if not flat_words:
        return list(heuristic_keywords or [])

    return flat_words


def _parse_llm_json(content: str) -> dict[str, Any] | None:
    content = content.strip()
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        pass
    start = content.find("{")
    end = content.rfind("}")
    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(content[start : end + 1])
        except json.JSONDecodeError:
            return None
    return None


def _groq_configured() -> bool:
    k = (settings.GROQ_API_KEY or "").strip().lower()
    if not k:
        return False
    if k in {"your_key", "changeme", "xxx", "sk-test"}:
        return False
    return True


def _groq_create(client: "Groq", **kwargs: Any) -> Any:
    """Call Groq chat.completions.create, adding reasoning_effort for gpt-oss models.

    If the SDK raises TypeError for the extra kwarg, retry once without it.
    """
    model = kwargs.get("model", "")
    if isinstance(model, str) and model.startswith("openai/gpt-oss"):
        try:
            return client.chat.completions.create(**kwargs, reasoning_effort="low")
        except TypeError:
            return client.chat.completions.create(**kwargs)
    return client.chat.completions.create(**kwargs)


def _maybe_enrich_with_groq(query: str, base: dict[str, Any]) -> dict[str, Any]:
    if not _groq_configured():
        return base
    try:
        client = Groq(api_key=settings.GROQ_API_KEY)
        prompt = _GROQ_PROMPT.format_messages(q=query[:240])[0].content
        resp = _groq_create(
            client,
            model=settings.GROQ_MODEL,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=512,
            temperature=0,
        )
        raw = (resp.choices[0].message.content or "").strip()
        print("[Groq] raw:", safe_for_console(raw[:200]))
        parsed = _parse_llm_json(raw)
        if not isinstance(parsed, dict):
            return base
        kws = parsed.get("keywords")
        mp = parsed.get("max_price")
        merged = dict(base)
        if isinstance(kws, list):
            cleaned = [
                str(x).strip().lower()
                for x in kws
                if isinstance(x, (str, int, float)) and str(x).strip()
            ]
            cleaned = [c for c in cleaned if len(c) > 1][:16]
            if cleaned:
                merged["keywords"] = cleaned
        if mp is None or isinstance(mp, (int, float)):
            if mp is not None:
                merged["max_price"] = float(mp)
        cat = parsed.get("category")
        if isinstance(cat, str) and cat.strip():
            cat_str = cat.strip().lower()
            heuristic_cat = base.get("category")
            if cat_str == "general" or (
                cat_str == "smartphone" and heuristic_cat == "smartphone"
            ):
                merged["category"] = cat_str
        cur = parsed.get("currency")
        if isinstance(cur, str) and cur.strip():
            merged["currency"] = cur.strip().upper()
        return merged
    except Exception as e:
        print("[Groq] failed:", safe_for_console(e))
        return base


@functools.lru_cache(maxsize=64)
def _parse_query_cached(query: str) -> dict[str, Any]:
    q = (query or "").strip()
    keywords = _extract_keywords_heuristic(q)
    max_price = _extract_max_price_heuristic(q)
    category_h = _detect_product_category(q)
    currency_h = _infer_budget_currency(q, max_price)
    base = {
        "keywords": keywords,
        "max_price": max_price,
        "original": q,
        "category": category_h,
        "currency": currency_h,
    }
    print("[Parse] heuristic:", safe_for_console(base))
    enriched = _maybe_enrich_with_groq(q, base)
    if not enriched.get("keywords"):
        enriched["keywords"] = _extract_keywords_heuristic(q)
    enriched.setdefault("original", q)
    if not enriched.get("category"):
        enriched["category"] = _detect_product_category(q)
    if not enriched.get("currency"):
        enriched["currency"] = _infer_budget_currency(q, enriched.get("max_price"))
    if _detect_product_category(q) == "smartphone":
        enriched["category"] = "smartphone"
    enriched["keywords"] = _sanitize_keywords(
        list(enriched.get("keywords") or []),
        base["keywords"],
    )
    cat = enriched.get("category")
    if isinstance(cat, str) and cat == "smartphone":
        enriched["keywords"] = _refine_keywords_for_category(
            list(enriched.get("keywords") or []),
            "smartphone",
            q,
        )
    mx = enriched.get("max_price")
    cur = enriched.get("currency") or _infer_budget_currency(q, enriched.get("max_price"))
    enriched["currency"] = cur

    if mx is not None and isinstance(mx, (int, float)):
        mode = (
            "around"
            if re.search(
                r"\b(?:around|about|approximately|approx|roughly)\s*[$€£]?\s*\d",
                q,
                re.I,
            )
            else "under"
        )
        if mode == "around":
            low = float(mx) * _AROUND_LOW_RATIO
            high = float(mx) * _AROUND_HIGH_RATIO
        else:
            low = float(mx) * _UNDER_FLOOR_RATIO
            high = float(mx)

        low_usd = _budget_to_price_cap_usd(low, cur)
        high_usd = _budget_to_price_cap_usd(high, cur)

        cur_str = (cur or "USD").upper()
        if cur_str == "USD":
            budget_note = f"${int(round(low)):,}–${int(round(high)):,}"
        else:
            budget_note = f"{cur_str} {int(round(low)):,}–{int(round(high)):,}"

        enriched["price_floor_usd"] = low_usd
        enriched["price_cap_usd"] = high_usd
        enriched["budget_mode"] = mode
        enriched["budget_note"] = budget_note
    else:
        enriched["price_floor_usd"] = None
        enriched["price_cap_usd"] = None
        enriched["budget_mode"] = ""
        enriched["budget_note"] = ""

    print("[Parse] final:", safe_for_console(enriched))
    return enriched


def parse_query(query: str) -> dict[str, Any]:
    return copy.deepcopy(_parse_query_cached(query))
