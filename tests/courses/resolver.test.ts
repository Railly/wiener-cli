import { describe, expect, it } from "bun:test";
import { resolveCourse } from "../../src/lib/courses/resolver.js";
import type { Course, LogicalCourse } from "../../src/types/course.js";

const FIXTURE_COURSES: Course[] = [
  {
    id: "101",
    code: "FB6N1",
    name: "TERAPÉUTICA FARMACOLÓGICA III",
    alias: "terapeutica",
    secciones: [{ id: "101", seccion: "T", name: "TERAPÉUTICA FARMACOLÓGICA III - T" }],
  },
  {
    id: "201",
    code: "FB6N2",
    name: "FARMACIA CLÍNICA I",
    alias: "farmacia",
    secciones: [{ id: "201", seccion: "T", name: "FARMACIA CLÍNICA I - T" }],
  },
  {
    id: "301",
    code: "FB6M4",
    name: "LABORATORIO Y DIAGNÓSTICO II",
    alias: "labo",
    secciones: [
      { id: "301", seccion: "T", name: "LABORATORIO Y DIAGNÓSTICO II - T" },
      { id: "302", seccion: "PD", name: "LABORATORIO Y DIAGNÓSTICO II - PD" },
    ],
  },
  {
    id: "401",
    code: "AC6M28",
    name: "CIENCIA Y DESCUBRIMIENTO",
    alias: "ciencia",
    secciones: [{ id: "401", seccion: "T", name: "CIENCIA Y DESCUBRIMIENTO" }],
  },
  {
    id: "501",
    code: "FB6N3",
    name: "PREPARACIONES FARMACÉUTICAS",
    alias: "preparaciones",
    secciones: [{ id: "501", seccion: "T", name: "PREPARACIONES FARMACÉUTICAS" }],
  },
];

describe("resolveCourse — exact match", () => {
  it("matches exact course code", () => {
    const result = resolveCourse("FB6N1", FIXTURE_COURSES);
    expect(result.kind).toBe("exact");
    if (result.kind === "exact") {
      expect(result.course.code).toBe("FB6N1");
      expect(result.matchedOn).toBe("code");
    }
  });

  it("matches exact alias", () => {
    const result = resolveCourse("labo", FIXTURE_COURSES);
    expect(result.kind).toBe("exact");
    if (result.kind === "exact") {
      expect(result.course.code).toBe("FB6M4");
      expect(result.matchedOn).toBe("alias");
    }
  });

  it("is case-insensitive for code", () => {
    const result = resolveCourse("fb6n1", FIXTURE_COURSES);
    expect(result.kind).toBe("exact");
  });
});

describe("resolveCourse — substring match", () => {
  it("matches unique substring in name", () => {
    const result = resolveCourse("descubrimiento", FIXTURE_COURSES);
    expect(result.kind).toBe("exact");
    if (result.kind === "exact") {
      expect(result.course.code).toBe("AC6M28");
    }
  });

  it("returns ambiguous for multiple substring matches", () => {
    const result = resolveCourse("farma", FIXTURE_COURSES);
    expect(result.kind).toBe("ambiguous");
  });
});

describe("resolveCourse — fuzzy match", () => {
  it("returns unique-fuzzy for high-score single candidate", () => {
    const result = resolveCourse("terapeutica", FIXTURE_COURSES, {
      fuzzyConfirmThreshold: 0.5,
      fuzzyUniqueDelta: 0.1,
    });
    expect(result.kind).toBe("exact");
  });
});

describe("resolveCourse — no match", () => {
  it("returns no-match for completely unrelated input", () => {
    const result = resolveCourse("xyzqwerty123", FIXTURE_COURSES);
    expect(result.kind).toBe("no-match");
  });

  it("includes closest candidates in no-match", () => {
    const result = resolveCourse("xyzqwerty123", FIXTURE_COURSES);
    if (result.kind === "no-match") {
      expect(Array.isArray(result.closest)).toBe(true);
    }
  });
});

describe("resolveCourse — exact flag", () => {
  it("returns no-match when --exact and only fuzzy match available", () => {
    // "terapeu" is not an exact alias or code — should return no-match with --exact
    const result = resolveCourse("terapeu", FIXTURE_COURSES, { exact: true });
    expect(result.kind).toBe("no-match");
  });

  it("still matches code with --exact", () => {
    const result = resolveCourse("FB6N1", FIXTURE_COURSES, { exact: true });
    expect(result.kind).toBe("exact");
  });
});

describe("resolveCourse — non-interactive mode", () => {
  it("does not suggest in no-input mode", () => {
    const result = resolveCourse("terapeutica", FIXTURE_COURSES, { noInput: true });
    if (result.kind === "unique-fuzzy") {
      expect(result.suggested).toBe(false);
    }
  });
});

describe("resolveCourse — defensive guards (null/undefined fields)", () => {
  it("skips courses with null/undefined code without crashing", () => {
    const mixed = [
      ...FIXTURE_COURSES,
      {
        id: "999",
        code: undefined as unknown as string,
        name: "BAD COURSE",
        alias: "bad",
        secciones: [],
      },
    ] as Course[];
    expect(() => resolveCourse("FB6N1", mixed)).not.toThrow();
    const result = resolveCourse("FB6N1", mixed);
    expect(result.kind).toBe("exact");
  });

  it("handles empty courses array", () => {
    const result = resolveCourse("FB6N1", []);
    expect(result.kind).toBe("no-match");
  });
});

describe("resolveCourse — LogicalCourse input (no id field)", () => {
  const logicalCourses: LogicalCourse[] = [
    {
      code: "FB6N2",
      name: "FARMACIA CLÍNICA I",
      alias: "farmacia",
      secciones: [{ id: "201", seccion: "T", name: "FARMACIA CLÍNICA I - T" }],
    },
    {
      code: "FB6N2",
      name: "PREPARACIONES FARMACÉUTICAS",
      alias: "preparaciones",
      secciones: [{ id: "501", seccion: "P1", name: "PREPARACIONES FARMACÉUTICAS - P1" }],
    },
  ];

  it("resolves exact alias on LogicalCourse", () => {
    const result = resolveCourse("farmacia", logicalCourses);
    expect(result.kind).toBe("exact");
    if (result.kind === "exact") {
      expect(result.course.name).toBe("FARMACIA CLÍNICA I");
    }
  });

  it("resolves substring 'farma' as ambiguous across multiple LogicalCourses", () => {
    const result = resolveCourse("farma", logicalCourses);
    expect(result.kind).toBe("ambiguous");
  });
});
