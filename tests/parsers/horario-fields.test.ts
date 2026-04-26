import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseHorario } from "../../src/lib/parsers/horario-table.ts";

const fixture = (name: string) => readFileSync(join(import.meta.dir, "../fixtures", name), "utf-8");

describe("parseHorario — field separation (no concatenation)", () => {
  test("course_code is isolated — not concatenated with name", () => {
    const html = fixture("horario-week.html");
    const data = parseHorario(html);
    const b = data.dias.L?.[0];
    expect(b).toBeDefined();
    if (!b) return;
    // course_code must NOT contain the course name
    expect(b.course_code).not.toContain("CIENCIA");
    expect(b.course_code).not.toContain("DESCUBRIMIENTO");
    // course_name must NOT contain the course code
    expect(b.course_name).not.toContain("AC6M28");
  });

  test("course_name is clean — no code prefix", () => {
    const html = fixture("horario-week.html");
    const data = parseHorario(html);
    const b = data.dias.L?.[0];
    if (!b) return;
    expect(b.course_name).toBe("CIENCIA Y DESCUBRIMIENTO");
  });

  test("teacher is separate from course_name", () => {
    const html = fixture("horario-week.html");
    const data = parseHorario(html);
    const b = data.dias.L?.[0];
    if (!b) return;
    // teacher must be in teacher field, not in course_name
    expect(b.course_name).not.toContain("Pérez");
    expect(b.teacher).toContain("Pérez");
  });

  test("room is separate from course_name", () => {
    const html = fixture("horario-week.html");
    const data = parseHorario(html);
    const tuesday = data.dias.M?.[0];
    if (!tuesday) return;
    // room (305) should not be inside course_name
    expect(tuesday.course_name).not.toContain("305");
    expect(tuesday.course_name).not.toContain("Aula");
  });

  test("Viernes bloque separates code from name", () => {
    const html = fixture("horario-week.html");
    const data = parseHorario(html);
    const v = data.dias.V?.[0];
    expect(v).toBeDefined();
    if (!v) return;
    expect(v.course_code).toBe("FB6N1");
    expect(v.course_name).not.toContain("FB6N1");
  });

  test("detailed fixture: course_code extracted from span children", () => {
    const html = fixture("horario-week-detailed.html");
    const data = parseHorario(html);
    const lunes = data.dias.L?.[0];
    expect(lunes).toBeDefined();
    if (!lunes) return;
    expect(lunes.course_code).toBe("AC6M28");
    expect(lunes.course_name).not.toContain("AC6M28");
    expect(lunes.course_name).not.toContain("AC4061");
  });

  test("detailed fixture: course_name stripped of internal section ID", () => {
    const html = fixture("horario-week-detailed.html");
    const data = parseHorario(html);
    const lunes = data.dias.L?.[0];
    if (!lunes) return;
    // AC4061 is the internal section ID — must be stripped from course_name
    expect(lunes.course_name).not.toContain("AC4061");
    expect(lunes.course_name).toContain("CIENCIA Y DESCUBRIMIENTO");
  });

  test("detailed fixture: teacher separated into teacher field", () => {
    const html = fixture("horario-week-detailed.html");
    const data = parseHorario(html);
    const lunes = data.dias.L?.[0];
    if (!lunes) return;
    expect(lunes.teacher).toContain("RAMIREZ");
    expect(lunes.course_name).not.toContain("RAMIREZ");
  });

  test("detailed fixture: type separated (Teoria/Practica)", () => {
    const html = fixture("horario-week-detailed.html");
    const data = parseHorario(html);
    const lunes = data.dias.L?.[0];
    if (!lunes) return;
    // Teoria/Practica should NOT be in course_name
    expect(lunes.course_name).not.toMatch(/Teor[íi]a|Pr[áa]ctica/i);
  });

  test("detailed fixture: viernes room extracted as room not name", () => {
    const html = fixture("horario-week-detailed.html");
    const data = parseHorario(html);
    const viernes = data.dias.V?.[0];
    if (!viernes) return;
    expect(viernes.course_name).not.toContain("WA201");
    expect(viernes.course_name).not.toContain("Aula");
    expect(viernes.room).toBeTruthy();
  });

  test("course_name does not contain time strings", () => {
    const html = fixture("horario-week-detailed.html");
    const data = parseHorario(html);
    const lunes = data.dias.L?.[0];
    if (!lunes) return;
    expect(lunes.course_name).not.toMatch(/\d{1,2}:\d{2}/);
    expect(lunes.course_name).not.toMatch(/a\. m\./i);
  });

  test("time fields are correctly split from cell text", () => {
    const html = fixture("horario-week-detailed.html");
    const data = parseHorario(html);
    const lunes = data.dias.L?.[0];
    if (!lunes) return;
    expect(lunes.time_start).toBe("07:00");
    expect(lunes.time_end).toBe("10:00");
  });

  test("Martes FB6M4 has separate code and clean name", () => {
    const html = fixture("horario-week-detailed.html");
    const data = parseHorario(html);
    const martes = data.dias.M?.[0];
    if (!martes) return;
    expect(martes.course_code).toBe("FB6M4");
    expect(martes.course_name).not.toContain("FB6M4");
    expect(martes.course_name).not.toContain("FB4089");
    expect(martes.course_name).toContain("LABORATORIO");
  });
});
