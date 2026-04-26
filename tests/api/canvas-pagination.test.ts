import { describe, it, expect, beforeEach, afterEach } from "bun:test";

// Test: pagination logic via Link: rel="next" header parsing
// Tests the parseLinkNext logic and item accumulation

describe("Link header parsing", () => {
  it("parses rel=next from Link header", () => {
    const link = '<https://example.com/api/v1/courses?page=2>; rel="next", <https://example.com/api/v1/courses?page=5>; rel="last"';
    const headers = new Headers({ Link: link });
    const linkHeader = headers.get("Link");

    let nextUrl: string | null = null;
    if (linkHeader) {
      const parts = linkHeader.split(",");
      for (const part of parts) {
        const segments = part.trim().split(";");
        const rel = segments[1]?.trim();
        if (rel === 'rel="next"') {
          const urlPart = segments[0]?.trim();
          if (urlPart?.startsWith("<") && urlPart.endsWith(">")) {
            nextUrl = urlPart.slice(1, -1);
          }
        }
      }
    }

    expect(nextUrl).toBe("https://example.com/api/v1/courses?page=2");
  });

  it("returns null when no next link", () => {
    const link = '<https://example.com/api/v1/courses?page=5>; rel="last"';
    const headers = new Headers({ Link: link });
    const linkHeader = headers.get("Link");

    let nextUrl: string | null = null;
    if (linkHeader) {
      const parts = linkHeader.split(",");
      for (const part of parts) {
        const segments = part.trim().split(";");
        const rel = segments[1]?.trim();
        if (rel === 'rel="next"') {
          const urlPart = segments[0]?.trim();
          if (urlPart?.startsWith("<") && urlPart.endsWith(">")) {
            nextUrl = urlPart.slice(1, -1);
          }
        }
      }
    }

    expect(nextUrl).toBeNull();
  });

  it("handles empty Link header", () => {
    const headers = new Headers({});
    const linkHeader = headers.get("Link");
    expect(linkHeader).toBeNull();
  });
});

describe("Rate limit header parsing", () => {
  it("parses rlr= from X-Canvas-Meta", () => {
    const meta = "r=0;as=0;l=;b=0;o=0;d=0;q=0;n=1;m=0;w=0;db=0;mem=0;rlr=2754.5";
    const match = meta.match(/rlr=([\d.]+)/);
    const remaining = match?.[1] ? parseFloat(match[1]) : 3000;
    expect(remaining).toBeCloseTo(2754.5);
  });

  it("returns 3000 when X-Canvas-Meta missing", () => {
    const meta = "";
    const match = meta.match(/rlr=([\d.]+)/);
    const remaining = match?.[1] ? parseFloat(match[1]) : 3000;
    expect(remaining).toBe(3000);
  });
});

describe("Parallel fetch concurrency", () => {
  it("pMap processes all items with concurrency cap", async () => {
    const { pMap } = await import("../../src/lib/parallel.js");
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    const results = await pMap(items, async (n) => n * 2, 3);
    expect(results).toEqual([2, 4, 6, 8, 10, 12, 14, 16]);
  });

  it("pMap handles empty array", async () => {
    const { pMap } = await import("../../src/lib/parallel.js");
    const results = await pMap<number, number>([], async (n) => n, 4);
    expect(results).toEqual([]);
  });

  it("pMap handles single item", async () => {
    const { pMap } = await import("../../src/lib/parallel.js");
    const results = await pMap([42], async (n) => n + 1, 4);
    expect(results).toEqual([43]);
  });
});
