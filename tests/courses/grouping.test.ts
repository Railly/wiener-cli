import { describe, it, expect } from "bun:test";
import { groupBySection, detectSection } from "../../src/lib/courses/grouping.js";
import type { Course } from "../../src/types/course.js";

describe("detectSection", () => {
  it("detects -T suffix", () => expect(detectSection("FB6N1-T")).toBe("T"));
  it("detects -P1 suffix", () => expect(detectSection("FB6N1-P1")).toBe("P1"));
  it("detects -PD suffix", () => expect(detectSection("FB6M4-PD")).toBe("PD"));
  it("detects -PE suffix", () => expect(detectSection("AC6M28-PE")).toBe("PE"));
  it("defaults to T when no pattern", () => expect(detectSection("FB6N1")).toBe("T"));
});

describe("groupBySection", () => {
  const courses: Course[] = [
    {
      id: 131067,
      code: "FB6N1",
      name: "TERAPÉUTICA FARMACOLÓGICA III",
      alias: "terapeutica",
      canvasName: "TERAPÉUTICA FARMACOLÓGICA III-T",
      section: "T",
      role: "StudentEnrollment",
    },
    {
      id: 131068,
      code: "FB6N1",
      name: "TERAPÉUTICA FARMACOLÓGICA III",
      alias: "terapeutica",
      canvasName: "TERAPÉUTICA FARMACOLÓGICA III-P1",
      section: "P1",
      role: "StudentEnrollment",
    },
    {
      id: 131070,
      code: "FB6M4",
      name: "LABORATORIO Y DIAGNÓSTICO II",
      alias: "laboratorio",
      canvasName: "LABORATORIO Y DIAGNÓSTICO II-T",
      section: "T",
      role: "StudentEnrollment",
    },
    {
      id: 131071,
      code: "FB6M4",
      name: "LABORATORIO Y DIAGNÓSTICO II",
      alias: "laboratorio",
      canvasName: "LABORATORIO Y DIAGNÓSTICO II-PD",
      section: "PD",
      role: "StudentEnrollment",
    },
    {
      id: 131072,
      code: "AC6M28",
      name: "CIENCIA Y DESCUBRIMIENTO",
      alias: "ciencia",
      canvasName: "CIENCIA Y DESCUBRIMIENTO-T",
      section: "T",
      role: "StudentEnrollment",
    },
  ];

  it("groups 5 Canvas courses into 3 logical courses", () => {
    const logical = groupBySection(courses);
    expect(logical).toHaveLength(3);
  });

  it("FB6N1 has T and P1 sections", () => {
    const logical = groupBySection(courses);
    const fb6n1 = logical.find((lc) => lc.code === "FB6N1");
    expect(fb6n1).toBeDefined();
    expect(fb6n1?.secciones).toHaveLength(2);
    const sectionTypes = fb6n1?.secciones.map((s) => s.seccion);
    expect(sectionTypes).toContain("T");
    expect(sectionTypes).toContain("P1");
  });

  it("FB6M4 has T and PD sections", () => {
    const logical = groupBySection(courses);
    const fb6m4 = logical.find((lc) => lc.code === "FB6M4");
    expect(fb6m4?.secciones).toHaveLength(2);
    const sectionTypes = fb6m4?.secciones.map((s) => s.seccion);
    expect(sectionTypes).toContain("T");
    expect(sectionTypes).toContain("PD");
  });

  it("AC6M28 has single T section", () => {
    const logical = groupBySection(courses);
    const ac = logical.find((lc) => lc.code === "AC6M28");
    expect(ac?.secciones).toHaveLength(1);
    expect(ac?.secciones[0]?.seccion).toBe("T");
  });

  it("sorts by code alphabetically", () => {
    const logical = groupBySection(courses);
    const codes = logical.map((lc) => lc.code);
    expect(codes).toEqual([...codes].sort());
  });
});
