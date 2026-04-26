// Two-layer cache: in-memory (per-process, instant) + file-based (5min TTL, persistent)

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { homedir } from "node:os";

const TTL_MS = 5 * 60 * 1000; // 5 minutes

// In-memory layer (survives for the process lifetime only)
const memCache = new Map<string, { value: unknown; expiresAt: number }>();

function cacheDir(): string {
  const base = process.env["WIENER_CONFIG_DIR"] ?? join(homedir(), ".wiener");
  const dir = join(base, "cache");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

function cacheKey(url: string): string {
  return createHash("sha256").update(url).digest("hex").slice(0, 16);
}

function cacheFilePath(key: string): string {
  return join(cacheDir(), `canvas-${key}.json`);
}

export function getFromCache<T>(url: string): { value: T; fromCache: true } | null {
  const key = cacheKey(url);
  const now = Date.now();

  // 1. In-memory
  const mem = memCache.get(key);
  if (mem && mem.expiresAt > now) {
    return { value: mem.value as T, fromCache: true };
  }

  // 2. File
  const filePath = cacheFilePath(key);
  if (existsSync(filePath)) {
    try {
      const raw = readFileSync(filePath, "utf-8");
      const entry = JSON.parse(raw) as { value: T; expiresAt: number };
      if (entry.expiresAt > now) {
        memCache.set(key, { value: entry.value, expiresAt: entry.expiresAt });
        return { value: entry.value, fromCache: true };
      }
    } catch {
      // corrupt cache file, ignore
    }
  }

  return null;
}

export function setCache<T>(url: string, value: T, ttlMs = TTL_MS): void {
  const key = cacheKey(url);
  const expiresAt = Date.now() + ttlMs;

  memCache.set(key, { value, expiresAt });

  try {
    writeFileSync(cacheFilePath(key), JSON.stringify({ value, expiresAt }));
  } catch {
    // non-fatal: in-memory cache is still active
  }
}

export function clearCache(): void {
  memCache.clear();
}
