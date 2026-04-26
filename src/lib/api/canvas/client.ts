// PHASE A WILL REPLACE: This is a stub implementing the expected contract.
// Phase A provides the real implementation with keychain auth, rate-limit tracking, etc.

import { WienerError } from "../../errors.js";

export interface RateLimit {
  remaining: number;
  used: number;
  resetAt?: string;
}

export interface CanvasResponse<T> {
  data: T;
  headers: Headers;
  rateLimit: RateLimit;
}

function parseRateLimit(headers: Headers): RateLimit {
  const meta = headers.get("X-Canvas-Meta") ?? "";
  const match = meta.match(/rlr=([\d.]+)/);
  const remaining = match?.[1] ? parseFloat(match[1]) : 3000;
  return { remaining, used: 3000 - remaining };
}

function getCanvasBaseUrl(): string {
  return process.env["WIENER_CANVAS_BASE_URL"] ?? "https://campus.uwiener.edu.pe";
}

function getCanvasToken(): string {
  const token = process.env["WIENER_CANVAS_TOKEN"];
  if (!token) {
    throw new WienerError("canvas-not-configured", "Canvas PAT not set. Run: wiener auth canvas set-token <pat>");
  }
  return token;
}

export async function canvasFetch<T>(
  path: string,
  options?: RequestInit & { queryParams?: Record<string, string | number | boolean | undefined> }
): Promise<CanvasResponse<T>> {
  const base = getCanvasBaseUrl();
  const token = getCanvasToken();

  let url = `${base}${path}`;
  if (options?.queryParams) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(options.queryParams)) {
      if (v !== undefined) params.append(k, String(v));
    }
    const qs = params.toString();
    if (qs) url += (url.includes("?") ? "&" : "?") + qs;
  }

  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "wiener-cli/0.1.0",
      ...options?.headers,
    },
  });

  if (res.status === 401) {
    throw new WienerError(
      "canvas-token-invalid",
      "Canvas PAT rejected (401). Regenerate with: wiener auth canvas pat new",
      "Token may have been revoked or expired"
    );
  }

  if (!res.ok) {
    throw new WienerError(
      "network-error",
      `Canvas API returned ${res.status} for ${path}`,
      `HTTP ${res.status}: ${res.statusText}`
    );
  }

  const data = (await res.json()) as T;
  const rateLimit = parseRateLimit(res.headers);

  if (rateLimit.remaining < 50) {
    const retryAfter = res.headers.get("Retry-After");
    throw new WienerError(
      "rate-limited",
      `Canvas rate limit low (${rateLimit.remaining} remaining)`,
      retryAfter ? `Retry after ${retryAfter}s` : undefined
    );
  }

  return { data, headers: res.headers, rateLimit };
}

export async function canvasFetchAll<T>(
  path: string,
  options?: RequestInit & { queryParams?: Record<string, string | number | boolean | undefined> }
): Promise<CanvasResponse<T[]>> {
  const allItems: T[] = [];
  let nextUrl: string | null = null;
  let lastHeaders: Headers = new Headers();
  let lastRateLimit: RateLimit = { remaining: 3000, used: 0 };

  const firstRes = await canvasFetch<T[]>(path, options);
  allItems.push(...firstRes.data);
  lastHeaders = firstRes.headers;
  lastRateLimit = firstRes.rateLimit;
  nextUrl = parseLinkNext(firstRes.headers);

  while (nextUrl) {
    const base = getCanvasBaseUrl();
    const token = getCanvasToken();

    const res = await fetch(nextUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": "wiener-cli/0.1.0",
      },
    });

    if (!res.ok) {
      throw new WienerError("network-error", `Pagination fetch failed: ${res.status}`);
    }

    const pageData = (await res.json()) as T[];
    allItems.push(...pageData);
    lastHeaders = res.headers;
    lastRateLimit = parseRateLimit(res.headers);
    nextUrl = parseLinkNext(res.headers);
  }

  return { data: allItems, headers: lastHeaders, rateLimit: lastRateLimit };
}

function parseLinkNext(headers: Headers): string | null {
  const link = headers.get("Link");
  if (!link) return null;

  const parts = link.split(",");
  for (const part of parts) {
    const segments = part.trim().split(";");
    const rel = segments[1]?.trim();
    if (rel === 'rel="next"') {
      const urlPart = segments[0]?.trim();
      if (urlPart?.startsWith("<") && urlPart.endsWith(">")) {
        return urlPart.slice(1, -1);
      }
    }
  }
  return null;
}
