import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseHistorial } from "../../src/lib/parsers/historial-table.ts";

const fixture = (name: string) =>
  readFileSync(join(import.meta.dir, "../fixtures", name), "utf-8");

describe("parseHistorial", () => {
  test("parses two ciclos", () => {
    const html = fixture("historial.html");
    const data = parseHistorial(html);
    expect(data.ciclos.length).toBe(2);
  });

  test("parses first ciclo periodo", () => {
    const html = fixture("historial.html");
    const { ciclos } = parseHistorial(html);
    expect(ciclos[0]?.periodo).toBe("2024-I");
  });

  test("parses second ciclo periodo", () => {
    const html = fixture("historial.html");
    const { ciclos } = parseHistorial(html);
    expect(ciclos[1]?.periodo).toBe("2024-II");
  });

  test("parses cursos in first ciclo", () => {
    const html = fixture("historial.html");
    const { ciclos } = parseHistorial(html);
    const firstCiclo = ciclos[0];
    expect(firstCiclo?.cursos.length).toBe(2);
    const quimica = firstCiclo?.cursos.find((c) => c.codigo === "FB4A1");
    expect(quimica).toBeDefined();
    expect(quimica?.nota_final).toBe(14);
    expect(quimica?.estado).toBe("APROBADO");
  });

  test("empty page returns empty ciclos", () => {
    const data = parseHistorial("<html><body></body></html>");
    expect(data.ciclos).toEqual([]);
  });
});
