import { describe, expect, it } from "bun:test";
import { groupBySection, parseSectionFromName } from "../../src/lib/courses/grouping.js";
import type { CanvasCourse } from "../../src/types/course.js";

describe("parseSectionFromName", () => {
  it("parses -T suffix", () => {
    const result = parseSectionFromName("LABORATORIO Y DIAGNÓSTICO II - T");
    expect(result.seccion).toBe("T");
    expect(result.baseName).toBe("LABORATORIO Y DIAGNÓSTICO II");
  });

  it("parses -PD suffix", () => {
    const result = parseSectionFromName("LABORATORIO Y DIAGNÓSTICO II - PD");
    expect(result.seccion).toBe("PD");
  });

  it("parses -P1 suffix", () => {
    const result = parseSectionFromName("TERAPÉUTICA FARMACOLÓGICA III - P1");
    expect(result.seccion).toBe("P1");
  });

  it("defaults to T when no suffix", () => {
    const result = parseSectionFromName("CIENCIA Y DESCUBRIMIENTO");
    expect(result.seccion).toBe("T");
    expect(result.baseName).toBe("CIENCIA Y DESCUBRIMIENTO");
  });

  it("parses P suffix", () => {
    const result = parseSectionFromName("FARMACIA CLÍNICA I - P");
    expect(result.seccion).toBe("P");
  });
});

describe("groupBySection", () => {
  const courses: CanvasCourse[] = [
    {
      id: "101",
      name: "LABORATORIO Y DIAGNÓSTICO II - T",
      course_code: "FB6M4",
      enrollment_state: "active",
    },
    {
      id: "102",
      name: "LABORATORIO Y DIAGNÓSTICO II - PD",
      course_code: "FB6M4",
      enrollment_state: "active",
    },
    {
      id: "201",
      name: "TERAPÉUTICA FARMACOLÓGICA III - T",
      course_code: "FB6N1",
      enrollment_state: "active",
    },
    {
      id: "202",
      name: "TERAPÉUTICA FARMACOLÓGICA III - P1",
      course_code: "FB6N1",
      enrollment_state: "active",
    },
    {
      id: "301",
      name: "CIENCIA Y DESCUBRIMIENTO",
      course_code: "AC6M28",
      enrollment_state: "active",
    },
  ];

  it("groups by course_code", () => {
    const grouped = groupBySection(courses);
    expect(grouped).toHaveLength(3);
  });

  it("merges sections for same code", () => {
    const grouped = groupBySection(courses);
    const labo = grouped.find((c) => c.code === "FB6M4");
    expect(labo?.secciones).toHaveLength(2);
  });

  it("assigns correct sections", () => {
    const grouped = groupBySection(courses);
    const labo = grouped.find((c) => c.code === "FB6M4");
    const sections = labo?.secciones.map((s) => s.seccion).sort();
    expect(sections).toEqual(["PD", "T"]);
  });

  it("single-section course defaults to T", () => {
    const grouped = groupBySection(courses);
    const ciencia = grouped.find((c) => c.code === "AC6M28");
    expect(ciencia?.secciones[0]?.seccion).toBe("T");
  });

  it("applies alias map", () => {
    const grouped = groupBySection(courses, { FB6M4: "labo", FB6N1: "terapeutica" });
    const labo = grouped.find((c) => c.code === "FB6M4");
    expect(labo?.alias).toBe("labo");
  });

  it("uses code as default alias when no map", () => {
    const grouped = groupBySection(courses);
    const ciencia = grouped.find((c) => c.code === "AC6M28");
    expect(ciencia?.alias).toBe("ac6m28");
  });
});
