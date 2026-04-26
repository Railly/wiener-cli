import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseAsistencia } from "../../src/lib/parsers/asistencia-table.ts";

const fixture = (name: string) => readFileSync(join(import.meta.dir, "../fixtures", name), "utf-8");

describe("parseAsistencia", () => {
  test("parses correct number of cursos", () => {
    const html = fixture("asistencia.html");
    const data = parseAsistencia(html);
    expect(data.cursos.length).toBe(4);
  });

  test("extracts codigo and nombre", () => {
    const html = fixture("asistencia.html");
    const { cursos } = parseAsistencia(html);
    const fb6n1 = cursos.find((c) => c.codigo === "FB6N1");
    expect(fb6n1).toBeDefined();
    expect(fb6n1?.nombre).toContain("TERAPÉUTICA");
  });

  test("parses numeric attendance fields", () => {
    const html = fixture("asistencia.html");
    const { cursos } = parseAsistencia(html);
    const fb6n1 = cursos.find((c) => c.codigo === "FB6N1");
    expect(fb6n1?.total_clases).toBe(20);
    expect(fb6n1?.asistencias).toBe(18);
    expect(fb6n1?.faltas).toBe(2);
    expect(fb6n1?.tardanzas).toBe(0);
    expect(fb6n1?.porcentaje).toBe(90);
  });

  test("parses decimal porcentaje", () => {
    const html = fixture("asistencia.html");
    const { cursos } = parseAsistencia(html);
    const fb6n2 = cursos.find((c) => c.codigo === "FB6N2");
    expect(fb6n2?.porcentaje).toBe(94.4);
  });

  test("100% attendance for perfect record", () => {
    const html = fixture("asistencia.html");
    const { cursos } = parseAsistencia(html);
    const fb6m4 = cursos.find((c) => c.codigo === "FB6M4");
    expect(fb6m4?.porcentaje).toBe(100);
    expect(fb6m4?.faltas).toBe(0);
  });

  test("empty page returns empty cursos", () => {
    const data = parseAsistencia("<html><body></body></html>");
    expect(data.cursos).toEqual([]);
  });
});
