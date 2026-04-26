import { describe, it, expect } from "bun:test";
import { ok, err } from "../../src/lib/output/envelope.js";

describe("envelope", () => {
  describe("ok()", () => {
    it("returns { ok: true, data } shape", () => {
      const env = ok({ tareas: [] });
      expect(env.ok).toBe(true);
      expect(env.data).toEqual({ tareas: [] });
    });

    it("includes meta when provided", () => {
      const env = ok({ items: [1, 2] }, { duration_ms: 50, from_cache: false });
      expect(env.meta?.duration_ms).toBe(50);
      expect(env.meta?.from_cache).toBe(false);
    });

    it("does not include meta when not provided", () => {
      const env = ok({ x: 1 });
      expect(env).not.toHaveProperty("meta");
    });
  });

  describe("err()", () => {
    it("returns { ok: false, error } shape", () => {
      const env = err("course-not-found", "No course matching");
      expect(env.ok).toBe(false);
      expect(env.error.code).toBe("course-not-found");
      expect(env.error.message).toBe("No course matching");
    });

    it("includes hint when provided", () => {
      const env = err("course-not-found", "Not found", "Try: wiener cursos");
      expect(env.error.hint).toBe("Try: wiener cursos");
    });

    it("includes details when provided", () => {
      const env = err("course-ambiguous", "Multiple matches", undefined, {
        candidates: [{ code: "FB6N1", score: 0.9 }],
      });
      expect(env.error.details?.["candidates"]).toHaveLength(1);
    });

    it("does not include hint when not provided", () => {
      const env = err("auth-required", "Login required");
      expect(env.error).not.toHaveProperty("hint");
    });
  });

  describe("JSON serialization", () => {
    it("ok envelope serializes correctly", () => {
      const env = ok({ n: 42 });
      const json = JSON.parse(JSON.stringify(env));
      expect(json.ok).toBe(true);
      expect(json.data.n).toBe(42);
    });

    it("err envelope serializes correctly", () => {
      const env = err("network-error", "Timeout");
      const json = JSON.parse(JSON.stringify(env));
      expect(json.ok).toBe(false);
      expect(json.error.code).toBe("network-error");
    });
  });
});
