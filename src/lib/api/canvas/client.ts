import type { RateLimit } from "../../../types/canvas.js";
import { DEFAULT_CONFIG } from "../../../types/config.js";
import { CanvasTokenInvalidError, NetworkError, RateLimitedError } from "../../errors.js";

const BASE_URL = DEFAULT_CONFIG.canvas.base_url;
const TIMEOUT_MS = DEFAULT_CONFIG.canvas.request_timeout_ms;

export interface CanvasFetchOptions extends RequestInit {
  token: string;
  baseUrl?: string;
  timeoutMs?: number;
}

export interface CanvasFetchResult<T = unknown> {
  data: T;
  headers: Headers;
  rateLimit: RateLimit;
}

function parseRateLimit(headers: Headers): RateLimit {
  const meta = headers.get("x-canvas-meta");
  if (!meta) return { remaining: null, requestCostEstimate: null };

  const rlrMatch = /rlr=([\d.]+)/.exec(meta);
  const rceMatch = /rce=([\d.]+)/.exec(meta);

  return {
    remaining: rlrMatch?.[1] ? Number.parseFloat(rlrMatch[1]) : null,
    requestCostEstimate: rceMatch?.[1] ? Number.parseFloat(rceMatch[1]) : null,
  };
}

function parseLinkNext(headers: Headers): string | null {
  const link = headers.get("link");
  if (!link) return null;

  const parts = link.split(",");
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.includes('rel="next"')) {
      const match = /<([^>]+)>/.exec(trimmed);
      if (match?.[1]) return match[1];
    }
  }
  return null;
}

export async function canvasFetch<T = unknown>(
  path: string,
  opts: CanvasFetchOptions,
): Promise<CanvasFetchResult<T>> {
  const { token, baseUrl = BASE_URL, timeoutMs = TIMEOUT_MS, ...init } = opts;
  const url = path.startsWith("http") ? path : `${baseUrl}${path}`;

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json+canvas-string-ids",
        "Content-Type": "application/json",
        ...((init.headers as Record<string, string>) ?? {}),
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (cause) {
    throw new NetworkError(`Failed to reach Canvas: ${url}`, cause);
  }

  if (response.status === 401) {
    throw new CanvasTokenInvalidError();
  }

  const rateLimit = parseRateLimit(response.headers);

  if (rateLimit.remaining !== null && rateLimit.remaining < 50) {
    throw new RateLimitedError(rateLimit.remaining);
  }

  const text = await response.text();
  let data: T;
  try {
    data = JSON.parse(text) as T;
  } catch {
    throw new NetworkError(
      `Canvas returned non-JSON (status ${response.status})`,
      text.slice(0, 200),
    );
  }

  return { data, headers: response.headers, rateLimit };
}

export async function canvasFetchAll<T = unknown>(
  path: string,
  opts: CanvasFetchOptions,
): Promise<CanvasFetchResult<T[]>> {
  const allData: T[] = [];
  let nextUrl: string | null = path;
  let lastHeaders = new Headers();
  let lastRateLimit: RateLimit = { remaining: null, requestCostEstimate: null };

  while (nextUrl !== null) {
    const result = await canvasFetch<T[]>(nextUrl, opts);
    const items = Array.isArray(result.data) ? result.data : [result.data as unknown as T];
    allData.push(...items);
    lastHeaders = result.headers;
    lastRateLimit = result.rateLimit;
    nextUrl = parseLinkNext(result.headers);
  }

  return { data: allData, headers: lastHeaders, rateLimit: lastRateLimit };
}
