import { describe, it, expect } from "bun:test";
import { fuzzyScore } from "../../src/lib/courses/fuzzy-score.js";

describe("fuzzyScore", () => {
  it("returns 1 for identical strings", () => {
    expect(fuzzyScore("farmacia", "farmacia")).toBe(1);
  });

  it("returns 1 for accent-folded identical", () => {
    expect(fuzzyScore("terapeutica", "terapéutica")).toBe(1);
  });

  it("returns high score for substring match", () => {
    expect(fuzzyScore("farma", "farmacologia")).toBeGreaterThan(0.5);
  });

  it("returns high score for starts-with match", () => {
    const score = fuzzyScore("lab", "laboratorio");
    expect(score).toBeGreaterThan(0.4);
  });

  it("returns 0 for empty query", () => {
    expect(fuzzyScore("", "farmacia")).toBe(0);
  });

  it("returns 0 for empty target", () => {
    expect(fuzzyScore("farm", "")).toBe(0);
  });

  it("returns low score for completely unrelated strings", () => {
    expect(fuzzyScore("zzz", "farmacologia")).toBeLessThan(0.3);
  });

  it("correctly scores acronym match", () => {
    const score = fuzzyScore("fb6", "fb6n1");
    expect(score).toBeGreaterThan(0.4);
  });

  it("scores exact match higher than partial", () => {
    const exactScore = fuzzyScore("farmacia", "farmacia");
    const partialScore = fuzzyScore("farma", "farmacia");
    expect(exactScore).toBeGreaterThan(partialScore);
  });
});
