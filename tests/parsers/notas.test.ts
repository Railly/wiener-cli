import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseNotas, parsePeriodos } from "../../src/lib/parsers/notas-table.ts";

const fixture = (name: string) =>
  readFileSync(join(import.meta.dir, "../fixtures", name), "utf-8");

describe("parseNotas", () => {
  test("extracts periodos from select options", () => {
    const html = fixture("notas-2026-I.html");
    const { periodos } = parseNotas(html);
    expect(periodos).toContain("2026-I");
    expect(periodos).toContain("2025-II");
    expect(periodos).toContain("2025-I");
    expect(periodos).toContain("2024-II");
    expect(periodos.length).toBe(4);
  });

  test("detects selected periodo", () => {
    const html = fixture("notas-2026-I.html");
    const { data } = parseNotas(html);
    expect(data.periodo).toBe("2026-I");
  });

  test("extracts alumno metadata", () => {
    const html = fixture("notas-2026-I.html");
    const { data } = parseNotas(html);
    expect(data.alumno.codigo).toBe("aXXXXXXXXX");
    expect(data.alumno.carrera).toContain("FARMACIA");
    expect(data.alumno.ciclo).toBe("VI");
  });

  test("parses ponderado values", () => {
    const html = fixture("notas-2026-I.html");
    const { data } = parseNotas(html);
    expect(data.ponderado_acumulado).toBe(14.52);
    expect(data.ponderado_historico).toBe(13.89);
    expect(data.orden_merito).toBe(5);
  });

  test("parses cursos with notas", () => {
    const html = fixture("notas-2026-I.html");
    const { data } = parseNotas(html);
    expect(data.cursos.length).toBe(4);

    const fb6n1 = data.cursos.find((c) => c.codigo === "FB6N1");
    expect(fb6n1).toBeDefined();
    expect(fb6n1?.nombre).toContain("TERAPÉUTICA");
    expect(fb6n1?.nota_final).toBe(15);
    expect(fb6n1?.estado).toBe("APROBADO");
    expect(fb6n1?.creditos).toBe(4);
  });

  test("parses curso with null nota (en curso)", () => {
    const html = fixture("notas-2026-I.html");
    const { data } = parseNotas(html);
    const fb6m4 = data.cursos.find((c) => c.codigo === "FB6M4");
    expect(fb6m4).toBeDefined();
    expect(fb6m4?.nota_final).toBeNull();
    expect(fb6m4?.estado).toBe("EN CURSO");
  });

  test("returns empty cursos when no periodo selected", () => {
    const html = fixture("notas-empty.html");
    const { data } = parseNotas(html);
    expect(data.cursos.length).toBe(0);
  });

  test("parsePeriodos standalone", () => {
    const html = fixture("notas-2026-I.html");
    const periodos = parsePeriodos(html);
    expect(periodos.length).toBeGreaterThan(0);
    expect(periodos[0]).toBe("2026-I");
  });
});
