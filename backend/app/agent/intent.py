"""Small-talk detection and friendly reply generation for the shopping agent."""

import re
from typing import Any

from groq import Groq

from app.agent.parser import _groq_configured, _groq_create
from app.config.settings import settings
from app.safe_log import safe_for_console


# ── Triggers & vocabulary ────────────────────────────────────────────

TRIGGERS: frozenset[str] = frozenset({
    "hello", "hi", "hey", "salam", "salaam", "assalam", "assalamualaikum",
    "alaikum", "walaikum", "thanks", "thank", "thx", "bye", "goodbye",
    "namaste", "aoa",
})

_PHRASE_TRIGGERS: tuple[str, ...] = (
    "how are you", "who are you", "what is your name",
    "kya haal", "kia haal", "kese ho", "kaise ho", "kaisay ho",
    "aap kaun", "tum kaun", "kaun ho",
    "good morning", "good evening", "good night",
)

CHAT_VOCAB: frozenset[str] = TRIGGERS | frozenset({
    "how", "are", "you", "who", "what", "is", "your", "name", "kya", "kia",
    "kyo", "kyun", "haal", "hal", "kaise", "kese", "kaisay", "ho", "hai",
    "hain", "raha", "rahi", "rahe", "aap", "tum", "aajkal", "aaj", "kal",
    "kaun", "good", "morning", "evening", "afternoon", "night", "ok", "okay",
    "yes", "no", "please", "help", "can", "do", "am", "i", "me", "my", "up",
    "doing", "there", "bro", "dost", "yaar", "sir", "madam", "apka", "aapka",
    "nam", "naam", "tera", "tumhara",
})

SUGGESTIONS: list[str] = [
    "Best wireless headphones under $100",
    "Smartphone under $300 with a great camera",
    "Lightweight gaming laptop under $1500",
]


# ── Detection ────────────────────────────────────────────────────────

def is_smalltalk(query: str) -> bool:
    """Return True when *query* is a greeting / small-talk, not a product search."""
    q = (query or "").strip()
    if not q:
        return False

    ql = q.lower()
    tokens = re.findall(r"[a-z]+", ql)
    if not tokens:
        return False

    # Must NOT contain digits or "$" (price indicators)
    if re.search(r"\d", q) or "$" in q:
        return False

    # Check phrase triggers
    phrase_hit = any(phrase in ql for phrase in _PHRASE_TRIGGERS)

    # Check single-word triggers
    trigger_hit = bool(TRIGGERS & set(tokens))

    if not (phrase_hit or trigger_hit):
        return False

    # At least 70 % of tokens must be chat vocabulary
    chat_count = sum(1 for t in tokens if t in CHAT_VOCAB)
    if chat_count / len(tokens) < 0.70:
        return False

    return True


# ── Reply ────────────────────────────────────────────────────────────

_FALLBACK_REPLY = (
    "Hi! I'm your AI shopping assistant. Tell me what you'd like to buy and your "
    "budget, for example: best wireless headphones under $100."
)

_SYSTEM_MSG = (
    "You are the friendly assistant of an AI Shopping Agent. Reply in English in "
    "at most 2 short sentences. Answer the greeting or question briefly and warmly "
    "(you are an AI, do not claim human feelings), then invite the user to say what "
    "they want to buy with a budget. Never invent products or prices."
)


def smalltalk_reply(query: str) -> str:
    """Return a warm reply to a greeting / small-talk *query* (synchronous)."""
    if not _groq_configured():
        return _FALLBACK_REPLY

    try:
        client = Groq(api_key=settings.GROQ_API_KEY)
        resp = _groq_create(
            client,
            model=settings.GROQ_MODEL,
            messages=[
                {"role": "system", "content": _SYSTEM_MSG},
                {"role": "user", "content": (query or "")[:300]},
            ],
            max_tokens=300,
            temperature=0.7,
        )
        text = (resp.choices[0].message.content or "").strip()
        if not text:
            return _FALLBACK_REPLY
        return text[:400]
    except Exception as e:
        print("[smalltalk_reply] failed:", safe_for_console(e))
        return _FALLBACK_REPLY
