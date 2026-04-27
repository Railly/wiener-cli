import { afterEach, describe, expect, it } from "bun:test";
import { canvasFetch } from "../../src/lib/api/canvas/client.js";
import { WienerFeatureDisabledError, WienerRestrictedError } from "../../src/lib/errors.js";

const TOKEN = "test-token-abc";

describe("canvasFetch — Wiener restriction detection", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("throws WienerRestrictedError on 200 with unauthorized body containing Wiener message", async () => {
    // @ts-ignore — test mock
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          status: "unauthorized",
          errors: [{ message: "usuario no autorizado para realizar esta acción" }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );

    await expect(canvasFetch("/api/v1/courses/123/files", { token: TOKEN })).rejects.toBeInstanceOf(
      WienerRestrictedError,
    );
  });

  it("throws WienerRestrictedError on 403 with unauthorized Wiener body", async () => {
    // @ts-ignore — test mock
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          status: "forbidden",
          errors: [{ message: "usuario no autorizado para realizar esta acción" }],
        }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      );

    await expect(
      canvasFetch("/api/v1/courses/123/rubrics", { token: TOKEN }),
    ).rejects.toBeInstanceOf(WienerRestrictedError);
  });

  it("throws WienerRestrictedError with correct path", async () => {
    // @ts-ignore — test mock
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          status: "unauthorized",
          errors: [{ message: "usuario no autorizado para realizar esta acción" }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );

    let thrown: unknown;
    try {
      await canvasFetch("/api/v1/courses/999/files", { token: TOKEN });
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(WienerRestrictedError);
    expect((thrown as WienerRestrictedError).code).toBe("wiener-restricted-endpoint");
    expect((thrown as WienerRestrictedError).path).toBe("/api/v1/courses/999/files");
  });

  it("still throws CanvasTokenInvalidError on generic unauthorized body", async () => {
    // @ts-ignore — test mock
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          status: "unauthorized",
          errors: [{ message: "Invalid access token." }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );

    let thrown: unknown;
    try {
      await canvasFetch("/api/v1/users/self", { token: TOKEN });
    } catch (e) {
      thrown = e;
    }
    expect(thrown).not.toBeInstanceOf(WienerRestrictedError);
    expect((thrown as Error).constructor.name).toBe("CanvasTokenInvalidError");
  });

  it("throws WienerFeatureDisabledError on 404 with HTML body (DOCTYPE)", async () => {
    // @ts-ignore — test mock
    globalThis.fetch = async () =>
      new Response("<!DOCTYPE html><html><body>404 Not Found</body></html>", {
        status: 404,
        headers: { "Content-Type": "text/html" },
      });

    await expect(canvasFetch("/api/v1/courses/123/pages", { token: TOKEN })).rejects.toBeInstanceOf(
      WienerFeatureDisabledError,
    );
  });

  it("throws WienerFeatureDisabledError on 404 with lowercase html tag body", async () => {
    // @ts-ignore — test mock
    globalThis.fetch = async () =>
      new Response("<html><head></head><body>Not Found</body></html>", {
        status: 404,
        headers: { "Content-Type": "text/html" },
      });

    await expect(
      canvasFetch("/api/v1/courses/123/quizzes", { token: TOKEN }),
    ).rejects.toBeInstanceOf(WienerFeatureDisabledError);
  });

  it("does NOT throw WienerFeatureDisabledError on 404 with JSON body", async () => {
    // @ts-ignore — test mock
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ errors: [{ message: "not found" }] }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });

    let thrown: unknown;
    try {
      await canvasFetch("/api/v1/courses/123/nonexistent", { token: TOKEN });
    } catch (e) {
      thrown = e;
    }
    expect(thrown).not.toBeInstanceOf(WienerFeatureDisabledError);
  });
});

describe("WienerRestrictedError", () => {
  it("has correct code and path", () => {
    const e = new WienerRestrictedError("/api/v1/courses/123/files");
    expect(e.code).toBe("wiener-restricted-endpoint");
    expect(e.path).toBe("/api/v1/courses/123/files");
    expect(e.hint).toBeTruthy();
  });

  it("accepts custom message", () => {
    const e = new WienerRestrictedError("/path", "custom msg");
    expect(e.message).toBe("custom msg");
  });
});

describe("WienerFeatureDisabledError", () => {
  it("has correct code and path", () => {
    const e = new WienerFeatureDisabledError("/api/v1/courses/123/pages");
    expect(e.code).toBe("wiener-feature-disabled");
    expect(e.path).toBe("/api/v1/courses/123/pages");
    expect(e.hint).toBeTruthy();
  });

  it("message mentions the feature extracted from path", () => {
    const e = new WienerFeatureDisabledError("/api/v1/courses/123/quizzes");
    expect(e.message).toContain("quizzes");
  });
});
