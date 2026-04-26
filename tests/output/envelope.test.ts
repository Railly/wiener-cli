import { describe, expect, it } from "bun:test";
import { err, ok } from "../../src/lib/output/envelope.js";

describe("ok()", () => {
  it("sets ok=true and wraps data", () => {
    const envelope = ok({ name: "test" });
    expect(envelope.ok).toBe(true);
    expect(envelope.data).toMatchObject({ name: "test" });
  });

  it("includes meta when provided", () => {
    const envelope = ok({ value: 1 }, { duration_ms: 100 });
    expect(envelope.meta?.duration_ms).toBe(100);
  });

  it("omits meta when not provided", () => {
    const envelope = ok({});
    expect(envelope.meta).toBeUndefined();
  });
});

describe("err()", () => {
  it("sets ok=false and wraps error", () => {
    const envelope = err("auth-required", "Not authenticated");
    expect(envelope.ok).toBe(false);
    expect(envelope.error.code).toBe("auth-required");
    expect(envelope.error.message).toBe("Not authenticated");
  });

  it("includes hint when provided", () => {
    const envelope = err("auth-required", "Not authenticated", "Run wiener auth login");
    expect(envelope.error.hint).toBe("Run wiener auth login");
  });

  it("omits hint when not provided", () => {
    const envelope = err("auth-required", "Not authenticated");
    expect(envelope.error.hint).toBeUndefined();
  });

  it("includes details when provided", () => {
    const envelope = err("course-ambiguous", "Multiple matches", undefined, { candidates: [] });
    expect(envelope.error.details).toMatchObject({ candidates: [] });
  });
});

describe("envelope shape contract", () => {
  it("ok envelope has no error key", () => {
    const envelope = ok({ data: 1 });
    expect("error" in envelope).toBe(false);
  });

  it("err envelope has no data key", () => {
    const envelope = err("parse-error", "failed");
    expect("data" in envelope).toBe(false);
  });
});
