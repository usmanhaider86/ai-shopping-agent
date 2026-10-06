import re
from typing import Any
from urllib.parse import quote_plus

from playwright.sync_api import sync_playwright

from app.safe_log import safe_for_console


def _parse_price_text(text: str) -> float | None:
    if not text:
        return None
    nums = re.findall(r"[\d.,]+", text.replace(",", ""))
    if not nums:
        return None
    try:
        return float(nums[0])
    except ValueError:
        return None


def scrape_products(keywords: list[str], limit: int = 5) -> list[dict[str, Any]]:
    q = " ".join(keywords).strip() or "shopping deals"
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent=(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                )
            )
            page = context.new_page()
            page.set_default_timeout(5000)
            url = (
                "https://www.ebay.com/sch/i.html?_nkw="
                + quote_plus(q)
                + "&_ipg=25"
            )
            page.goto(url, wait_until="domcontentloaded", timeout=5000)
            page.wait_for_timeout(800)
            cards = page.query_selector_all("li.s-item")
            out: list[dict[str, Any]] = []
            for card in cards[: limit * 3]:
                if len(out) >= limit:
                    break
                title_el = card.query_selector(".s-item__title")
                price_el = card.query_selector(".s-item__price")
                link_el = card.query_selector("a.s-item__link")
                title = (title_el.inner_text() if title_el else "") or ""
                title = title.strip()
                if not title or title.lower().startswith("shop on ebay"):
                    continue
                price_txt = (price_el.inner_text() if price_el else "") or ""
                href = ""
                if link_el:
                    try:
                        href = link_el.get_attribute("href") or ""
                    except Exception:
                        href = ""
                price = _parse_price_text(price_txt) or 0.0
                out.append(
                    {
                        "name": title[:500],
                        "price": price,
                        "category": "general",
                        "source": "scraper",
                        "link": href or "https://www.ebay.com",
                    }
                )
            context.close()
            browser.close()
            print("[Scraper] count:", len(out))
            return out
    except Exception as e:
        print("[Scraper] error:", safe_for_console(e))
        return []
