import { afterEach, describe, expect, it } from "bun:test";
import { canvasFetch, canvasFetchAll } from "../../src/lib/api/canvas/client.js";

const TOKEN = "test-token-123";

describe("canvasFetch", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns data on success", async () => {
    // @ts-ignore — test mock
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ id: "1", name: "Test User" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    const result = await canvasFetch("/api/v1/users/self", { token: TOKEN });
    expect(result.data).toMatchObject({ id: "1", name: "Test User" });
  });

  it("throws canvas-token-invalid on 401", async () => {
    // @ts-ignore — test mock
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ errors: [{ message: "Invalid access token" }] }), {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "WWW-Authenticate": "Bearer realm='canvas-lms'",
        },
      });

    await expect(canvasFetch("/api/v1/users/self", { token: TOKEN })).rejects.toThrow();
  });

  it("parses rate limit from X-Canvas-Meta header", async () => {
    // @ts-ignore — test mock
    globalThis.fetch = async () =>
      new Response(JSON.stringify([]), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "X-Canvas-Meta": "rlr=250.0;rce=1.0",
        },
      });

    const result = await canvasFetch("/api/v1/courses", { token: TOKEN });
    expect(result.rateLimit.remaining).toBe(250.0);
  });
});

describe("canvasFetchAll — pagination", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("follows Link rel=next and accumulates all pages", async () => {
    let callCount = 0;
    const BASE = "https://campus.uwiener.edu.pe";

    // @ts-ignore — test mock
    globalThis.fetch = async (input: string | URL | Request) => {
      callCount++;
      const _url = typeof input === "string" ? input : input.toString();

      let linkHeader = "";
      if (callCount === 1) linkHeader = `<${BASE}/api/v1/courses/page2>; rel="next"`;
      else if (callCount === 2) linkHeader = `<${BASE}/api/v1/courses/page3>; rel="next"`;

      const data =
        callCount === 1 ? [{ id: "1" }] : callCount === 2 ? [{ id: "2" }] : [{ id: "3" }];

      return new Response(JSON.stringify(data), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...(linkHeader ? { link: linkHeader } : {}),
        },
      });
    };

    const result = await canvasFetchAll<{ id: string }>(`${BASE}/api/v1/courses/page1`, {
      token: TOKEN,
    });

    expect(result.data).toHaveLength(3);
    expect(callCount).toBe(3);
  });

  it("returns single page when no Link header", async () => {
    // @ts-ignore — test mock
    globalThis.fetch = async () =>
      new Response(JSON.stringify([{ id: "1" }, { id: "2" }]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    const result = await canvasFetchAll<{ id: string }>("/api/v1/courses", { token: TOKEN });
    expect(result.data).toHaveLength(2);
  });
});
