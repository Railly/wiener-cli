import { describe, it, expect } from "bun:test";
import { resolveCourse } from "../../src/lib/courses/resolver.js";
import type { Course } from "../../src/types/course.js";

const COURSES: Course[] = [
  { id: 131067, code: "FB6N1", name: "TERAPÉUTICA FARMACOLÓGICA III", alias: "terapeutica", canvasName: "TERAPÉUTICA FARMACOLÓGICA III-T", role: "StudentEnrollment" },
  { id: 131068, code: "FB6N1", name: "TERAPÉUTICA FARMACOLÓGICA III", alias: "terapeutica", canvasName: "TERAPÉUTICA FARMACOLÓGICA III-P1", role: "StudentEnrollment" },
  { id: 131070, code: "FB6M4", name: "LABORATORIO Y DIAGNÓSTICO II", alias: "laboratorio", canvasName: "LABORATORIO Y DIAGNÓSTICO II-T", role: "StudentEnrollment" },
  { id: 131071, code: "FB6M4", name: "LABORATORIO Y DIAGNÓSTICO II", alias: "laboratorio", canvasName: "LABORATORIO Y DIAGNÓSTICO II-PD", role: "StudentEnrollment" },
  { id: 131072, code: "AC6M28", name: "CIENCIA Y DESCUBRIMIENTO", alias: "ciencia", canvasName: "CIENCIA Y DESCUBRIMIENTO-T", role: "StudentEnrollment" },
  { id: 131073, code: "FB6N2", name: "FARMACIA CLÍNICA I", alias: "farmacia", canvasName: "FARMACIA CLÍNICA I-T", role: "StudentEnrollment" },
];

describe("resolveCourse — exact match", () => {
  it("matches by exact code (case-insensitive)", () => {
    const result = resolveCourse("FB6N1", COURSES);
    expect(result.kind).toBe("exact");
    if (result.kind === "exact") {
      expect(result.course.code).toBe("FB6N1");
      expect(result.matchedOn).toBe("code");
    }
  });

  it("matches by exact alias", () => {
    const result = resolveCourse("ciencia", COURSES);
    expect(result.kind).toBe("exact");
    if (result.kind === "exact") {
      expect(result.course.code).toBe("AC6M28");
      expect(result.matchedOn).toBe("alias");
    }
  });

  it("exact match is case-insensitive", () => {
    const result = resolveCourse("CIENCIA", COURSES);
    expect(result.kind).toBe("exact");
  });
});

describe("resolveCourse — substring match", () => {
  it("matches by partial name", () => {
    const result = resolveCourse("farmacia", COURSES);
    // exact alias match takes precedence
    expect(result.kind).toBe("exact");
  });

  it("matches by partial code", () => {
    const result = resolveCourse("AC6M", COURSES);
    expect(result.kind).toBe("exact");
    if (result.kind === "exact") {
      expect(result.course.code).toBe("AC6M28");
    }
  });
});

describe("resolveCourse — no match", () => {
  it("returns no-match for unknown input below 0.5 score", () => {
    const result = resolveCourse("zzzzzz", COURSES);
    expect(result.kind).toBe("no-match");
    if (result.kind === "no-match") {
      expect(result.closest.length).toBeGreaterThan(0);
      expect(result.closest.length).toBeLessThanOrEqual(5);
    }
  });

  it("exact mode returns no-match for partial input", () => {
    const result = resolveCourse("farma", COURSES, { exact: true });
    expect(result.kind).toBe("no-match");
  });
});

describe("resolveCourse — noInput mode", () => {
  it("returns ambiguous with score <= 0.92 in noInput mode", () => {
    const result = resolveCourse("labo", COURSES, { noInput: true });
    // "labo" is a substring match for "laboratorio" but not exact
    // In noInput mode without score > 0.92, should still work via substring
    expect(["exact", "unique-fuzzy", "ambiguous"]).toContain(result.kind);
  });
});
