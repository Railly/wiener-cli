import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parsePerfil } from "../../src/lib/parsers/perfil-table.ts";

const fixture = (name: string) =>
  readFileSync(join(import.meta.dir, "../fixtures", name), "utf-8");

describe("parsePerfil", () => {
  test("parses codigo", () => {
    const html = fixture("perfil.html");
    const data = parsePerfil(html);
    expect(data.codigo).toBe("aXXXXXXXXX");
  });

  test("parses nombres and apellidos", () => {
    const html = fixture("perfil.html");
    const data = parsePerfil(html);
    expect(data.nombres).toBe("MARIA ELENA");
    expect(data.apellidos).toBe("GARCIA LOPEZ");
  });

  test("parses DNI", () => {
    const html = fixture("perfil.html");
    const data = parsePerfil(html);
    expect(data.dni).toBe("74123456");
  });

  test("parses carrera", () => {
    const html = fixture("perfil.html");
    const data = parsePerfil(html);
    expect(data.carrera).toContain("FARMACIA");
  });

  test("parses optional fields", () => {
    const html = fixture("perfil.html");
    const data = parsePerfil(html);
    expect(data.facultad).toContain("SALUD");
    expect(data.email).toContain("uwiener.edu.pe");
    expect(data.ciclo).toBe("VI");
  });

  test("empty page returns minimal object", () => {
    const data = parsePerfil("<html><body></body></html>");
    expect(data.codigo).toBe("");
    expect(data.nombres).toBe("");
  });
});
