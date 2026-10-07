import type { SearchRequest, SearchResponse } from "@/types/shopping";

/**
 * Base URL for the FastAPI backend.
 * Set VITE_API_URL in your .env (e.g. http://localhost:8000).
 *
 * If VITE_API_URL is unset or empty in dev, requests use the Vite dev server
 * origin and vite.config.ts proxies /api and /health to FastAPI (no CORS needed).
 */
function resolveApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_URL as string | undefined;
  if (raw === undefined || raw === "") {
    return import.meta.env.DEV ? "" : "http://localhost:8000";
  }
  return raw.replace(/\/$/, "");
}

export const API_BASE_URL: string = resolveApiBaseUrl();

export class ApiError extends Error {
  code?: number;
  details?: unknown;
  constructor(message: string, code?: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.details = details;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(init?.headers || {}),
      },
    });
  } catch (err) {
    throw new ApiError(
      "Could not reach the AI Shopping Agent API. Check your connection or VITE_API_URL.",
      0,
      err,
    );
  }

  if (!res.ok) {
    let payload: unknown = null;
    try {
      payload = await res.json();
    } catch {
      /* ignore */
    }
    if (res.status === 422) {
      throw new ApiError(
        "Your search couldn't be processed. Please refine your query (1–500 characters).",
        422,
        payload,
      );
    }
    if (res.status === 429) {
      throw new ApiError(
        "You're searching too fast. Please wait a moment and try again.",
        429,
        payload,
      );
    }
    throw new ApiError(
      `Request failed with status ${res.status}.`,
      res.status,
      payload,
    );
  }

  return (await res.json()) as T;
}

export const api = {
  health: () => request<{ status: string }>("/health"),
  search: (body: SearchRequest) =>
    request<SearchResponse>("/api/shopping/search", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};
