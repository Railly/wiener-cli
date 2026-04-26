import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseMatricula } from "../../src/lib/parsers/matricula-table.ts";

const fixture = (name: string) => readFileSync(join(import.meta.dir, "../fixtures", name), "utf-8");

describe("parseMatricula", () => {
  test("parses periodo and ciclo", () => {
    const html = fixture("matricula.html");
    const data = parseMatricula(html);
    expect(data.periodo).toBe("2026-I");
    expect(data.ciclo).toBe("VI");
  });

  test("parses correct number of cursos", () => {
    const html = fixture("matricula.html");
    const data = parseMatricula(html);
    expect(data.cursos.length).toBe(4);
  });

  test("parses curso fields", () => {
    const html = fixture("matricula.html");
    const { cursos } = parseMatricula(html);
    const fb6n1 = cursos.find((c) => c.codigo === "FB6N1");
    expect(fb6n1).toBeDefined();
    expect(fb6n1?.nombre).toContain("TERAPÉUTICA");
    expect(fb6n1?.creditos).toBe(4);
    expect(fb6n1?.seccion).toBe("A");
    expect(fb6n1?.modalidad).toBe("Presencial");
  });

  test("parses remote course", () => {
    const html = fixture("matricula.html");
    const { cursos } = parseMatricula(html);
    const ac6m28 = cursos.find((c) => c.codigo === "AC6M28");
    expect(ac6m28?.modalidad).toBe("Remoto");
  });

  test("empty page returns empty cursos", () => {
    const data = parseMatricula("<html><body></body></html>");
    expect(data.cursos).toEqual([]);
  });
});
