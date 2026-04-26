import { describe, expect, it } from "bun:test";
import { WienerError, isWienerError, toErrorEnvelope } from "../../src/lib/errors.js";

describe("WienerError", () => {
  it("has correct code and message", () => {
    const e = new WienerError("canvas-token-invalid", "PAT rejected", {
      hint: "Regenerate via wiener auth canvas pat new",
    });
    expect(e.code).toBe("canvas-token-invalid");
    expect(e.message).toBe("PAT rejected");
    expect(e.hint).toBe("Regenerate via wiener auth canvas pat new");
    expect(e.name).toBe("WienerError");
  });

  it("isWienerError returns true for WienerError instances", () => {
    const e = new WienerError("auth-required", "Login required");
    expect(isWienerError(e)).toBe(true);
  });

  it("isWienerError returns false for plain Error", () => {
    const e = new Error("plain error");
    expect(isWienerError(e)).toBe(false);
  });

  it("isWienerError returns false for non-Error", () => {
    expect(isWienerError("string")).toBe(false);
    expect(isWienerError(null)).toBe(false);
    expect(isWienerError(42)).toBe(false);
  });

  it("toErrorEnvelope converts WienerError correctly", () => {
    const e = new WienerError("rate-limited", "Too many requests", { hint: "Wait 60s" });
    const env = toErrorEnvelope(e);
    expect(env.ok).toBe(false);
    expect(env.error.code).toBe("rate-limited");
    expect(env.error.hint).toBe("Wait 60s");
  });

  it("toErrorEnvelope handles plain Error", () => {
    const e = new Error("connection refused");
    const env = toErrorEnvelope(e);
    expect(env.ok).toBe(false);
    expect(env.error.code).toBe("network-error");
    expect(env.error.message).toBe("connection refused");
  });

  it("toErrorEnvelope handles non-Error (string)", () => {
    const env = toErrorEnvelope("something went wrong");
    expect(env.ok).toBe(false);
    expect(env.error.message).toBe("something went wrong");
  });

  it("WienerError without hint has no hint property", () => {
    const e = new WienerError("auth-required", "Login required");
    expect(e.hint).toBeUndefined();
  });

  it("WienerError supports all canonical codes", () => {
    const codes = [
      "auth-required",
      "auth-expired",
      "canvas-not-configured",
      "canvas-token-invalid",
      "course-not-found",
      "course-ambiguous",
      "network-error",
      "rate-limited",
      "parse-error",
      "validation-error",
      "not-implemented",
    ] as const;

    for (const code of codes) {
      const e = new WienerError(code, "test");
      expect(e.code).toBe(code);
      expect(isWienerError(e)).toBe(true);
    }
  });
});
