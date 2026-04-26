import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseHorario } from "../../src/lib/parsers/horario-table.ts";

const fixture = (name: string) =>
  readFileSync(join(import.meta.dir, "../fixtures", name), "utf-8");

describe("parseHorario", () => {
  test("returns all day keys", () => {
    const html = fixture("horario-week.html");
    const data = parseHorario(html);
    expect(data.dias).toHaveProperty("L");
    expect(data.dias).toHaveProperty("M");
    expect(data.dias).toHaveProperty("X");
    expect(data.dias).toHaveProperty("J");
    expect(data.dias).toHaveProperty("V");
    expect(data.dias).toHaveProperty("S");
  });

  test("parses Lunes bloque with correct time", () => {
    const html = fixture("horario-week.html");
    const data = parseHorario(html);
    const bloques = data.dias["L"] ?? [];
    expect(bloques.length).toBeGreaterThan(0);
    const b = bloques[0];
    expect(b).toBeDefined();
    if (b) {
      expect(b.time_start).toBe("07:00");
      expect(b.time_end).toBe("10:00");
    }
  });

  test("parses PM time correctly", () => {
    const html = fixture("horario-week.html");
    const data = parseHorario(html);
    const martes = data.dias["M"] ?? [];
    const b = martes.find((bl) => bl.time_start === "11:30");
    expect(b).toBeDefined();
    if (b) {
      expect(b.time_end).toBe("14:00");
    }
  });

  test("parses Viernes bloque", () => {
    const html = fixture("horario-week.html");
    const data = parseHorario(html);
    const viernes = data.dias["V"] ?? [];
    expect(viernes.length).toBeGreaterThan(0);
    const b = viernes[0];
    if (b) {
      expect(b.time_start).toBe("15:00");
      expect(b.time_end).toBe("18:00");
    }
  });

  test("detects semana text", () => {
    const html = fixture("horario-week.html");
    const data = parseHorario(html);
    expect(data.semana).toContain("2026");
  });

  test("empty table returns empty dias", () => {
    const data = parseHorario("<html><body></body></html>");
    expect(data.dias["L"]).toEqual([]);
    expect(data.dias["M"]).toEqual([]);
  });
});
