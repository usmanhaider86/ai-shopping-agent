---
title: AI Shopping Agent API
emoji: 🛒
colorFrom: blue
colorTo: green
sdk: docker
app_port: 7860
pinned: false
---

# AI Shopping Agent (Backend)

FastAPI service that searches products using **MongoDB → RapidAPI (Amazon) → Playwright (eBay)**, with optional **Groq** for light query understanding. When no matching products are found, the API returns an empty list with an honest message instead of fabricated data.

## Setup

```bash
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
playwright install chromium
```

Copy `.env` and set real keys (or leave placeholders; the stack still attempts the scraper but returns an empty list if nothing is found).

## Run

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Open Swagger UI: `http://127.0.0.1:8000/docs`

## Endpoint

`POST /api/shopping/search`

Body:

```json
{ "query": "Find power banks under 5000 PKR" }
```

Response:

```json
{ "products": [ { "name": "...", "price": 0, "category": "...", "source": "...", "link": "..." } ] }
```

## MongoDB sample documents

Collection: `shopping_db.products` (configurable via `MONGODB_DB` / `MONGODB_COLLECTION`).

```json
{
  "name": "Anker Power Bank 10000mAh",
  "price": 4500,
  "category": "electronics",
  "link": "https://example.com/p/anker",
  "source": "seed"
}
```

## Notes

- **RapidAPI**: uses `real-time-amazon-data` search; subscribe on RapidAPI and set `RAPIDAPI_KEY` (and optionally `RAPIDAPI_HOST`).
- **Playwright**: runs headless Chromium with a 5s timeout; failures return `[]` and the pipeline continues.
- **Groq**: optional; if missing or failing, heuristic parsing is used.
