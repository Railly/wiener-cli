import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseExamenes } from "../../src/lib/parsers/examenes-table.ts";

const fixture = (name: string) =>
  readFileSync(join(import.meta.dir, "../fixtures", name), "utf-8");

describe("parseExamenes", () => {
  test("parses correct number of examenes", () => {
    const html = fixture("examenes.html");
    const data = parseExamenes(html);
    expect(data.examenes.length).toBe(3);
  });

  test("parses first examen with ISO date", () => {
    const html = fixture("examenes.html");
    const { examenes } = parseExamenes(html);
    const first = examenes[0];
    expect(first).toBeDefined();
    if (first) {
      expect(first.fecha).toBe("2026-05-05");
      expect(first.hora).toBe("08:00");
      expect(first.modalidad).toBe("Presencial");
      expect(first.aula).toBe("Aula 301");
    }
  });

  test("converts DD/MM/YYYY to ISO 8601", () => {
    const html = fixture("examenes.html");
    const { examenes } = parseExamenes(html);
    for (const e of examenes) {
      expect(e.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  test("parses virtual exam", () => {
    const html = fixture("examenes.html");
    const { examenes } = parseExamenes(html);
    const virtual = examenes.find((e) => e.modalidad === "Virtual");
    expect(virtual).toBeDefined();
    expect(virtual?.aula).toBe("Zoom");
  });

  test("empty page returns empty examenes", () => {
    const data = parseExamenes("<html><body></body></html>");
    expect(data.examenes).toEqual([]);
  });
});
