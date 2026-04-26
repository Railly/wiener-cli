import { describe, expect, it } from "bun:test";
import { fuzzyScore } from "../../src/lib/courses/fuzzy-score.js";

describe("fuzzyScore", () => {
  it("returns 1.0 for exact match", () => {
    expect(fuzzyScore("farmacia", "farmacia")).toBe(1.0);
  });

  it("returns 1.0 for case-insensitive exact match", () => {
    expect(fuzzyScore("FARMACIA", "farmacia")).toBe(1.0);
  });

  it("returns high score for substring", () => {
    const score = fuzzyScore("farma", "TERAPÉUTICA FARMACOLÓGICA III");
    expect(score).toBeGreaterThan(0.4);
  });

  it("returns high score for accent-normalized substring", () => {
    const score = fuzzyScore("terapeutica", "TERAPÉUTICA FARMACOLÓGICA III");
    expect(score).toBeGreaterThan(0.45);
  });

  it("returns score for acronym match", () => {
    const score = fuzzyScore("lyd", "LABORATORIO Y DIAGNOSTICO");
    expect(score).toBeGreaterThan(0);
  });

  it("returns high score for starts-with", () => {
    const score = fuzzyScore("labo", "laboratorio");
    expect(score).toBeGreaterThan(0.5);
  });

  it("returns 0 for empty needle", () => {
    expect(fuzzyScore("", "farmacia")).toBe(0);
  });

  it("returns 0 for empty haystack", () => {
    expect(fuzzyScore("farma", "")).toBe(0);
  });

  it("returns lower score for poor match", () => {
    const good = fuzzyScore("farma", "FARMACIA CLINICA I");
    const bad = fuzzyScore("farma", "CIENCIA Y DESCUBRIMIENTO");
    expect(good).toBeGreaterThan(bad);
  });

  it("returns a score between 0 and 1", () => {
    const score = fuzzyScore("fb6n1", "FB6N1 - TERAPEUTICA");
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it("consecutive run bonus works for long prefix", () => {
    const score = fuzzyScore("laboratorio", "laboratorio y diagnostico ii");
    expect(score).toBeGreaterThan(0.8);
  });
});
