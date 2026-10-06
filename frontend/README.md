# AI Shopping Agent — Frontend

A premium, modern shopping UI for the **AI Shopping Agent** FastAPI backend.

> ⚠️ **About Next.js**: this project was originally requested in Next.js, but
> Lovable runs on **React + Vite + TypeScript**. The integration with FastAPI
> is identical — only the env-var prefix changes (`VITE_*` instead of
> `NEXT_PUBLIC_*`). Clerk, MongoDB, LangGraph, etc. all stay on the backend.

## Backend integration

Set the FastAPI base URL in `.env`:

```bash
VITE_API_URL=http://localhost:8000
```

Endpoints consumed (no auth required):

| Method | Path                    | Purpose                       |
| ------ | ----------------------- | ----------------------------- |
| GET    | `/health`               | Connectivity dot in header    |
| POST   | `/api/shopping/search`  | Main search (body: `{query}`) |

TypeScript interfaces matching the backend live in `src/types/shopping.ts`.

### CORS / dev proxy

FastAPI doesn't enable CORS by default. Either add `CORSMiddleware` on the
backend, or set `VITE_API_URL=""` and rely on the Vite dev proxy already
configured in `vite.config.ts` (forwards `/api` and `/health` to
`VITE_API_PROXY_TARGET`, default `http://localhost:8000`).

## Adding Clerk later

Wrap `<App />` with `<ClerkProvider publishableKey={...}>` in `src/main.tsx`
and add `<SignedIn> / <SignedOut>` guards as needed.
