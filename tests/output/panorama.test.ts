import { describe, expect, test } from "bun:test";
import { renderPanorama } from "../../src/lib/output/panorama-renderer.js";
import type { Panorama } from "../../src/lib/workflows/panorama.js";

function makePanorama(overrides: Partial<Panorama> = {}): Panorama {
  const now = new Date();
  const due = new Date(now);
  due.setHours(23, 0, 0, 0);
  return {
    fecha_label: "Lunes 27 abril 2026",
    ahora: {
      time_start: "07:00",
      time_end: "10:00",
      course_code: "AC6M28",
      course_name: "CIENCIA Y DESCUBRIMIENTO",
      section: "T",
      type: "Remoto-Videoconf",
      room: "Virtual",
      building: "Online",
      teacher: "Pérez, {REDACTED_NAME}",
    },
    proximo: {
      time_start: "11:30",
      time_end: "14:00",
      course_code: "FB6M4",
      course_name: "LABORATORIO Y DIAGNÓSTICO II",
      section: "PD",
      type: "Presencial",
      room: "Aula 305",
      building: "Pabellón B",
      teacher: "García, Luis",
    },
    eta_minutos: 83,
    pendiente_hoy: [
      {
        tipo: "entrega",
        curso: "FB6N1",
        titulo: "Informe semanal UD2",
        due,
        url: "https://example.com",
      },
    ],
    esta_semana: { tareas_count: 3, quizzes_count: 2 },
    diff_items: [
      {
        tipo: "calificacion",
        curso: "AC6M28",
        titulo: "Práctica calificada 1",
        detalle: "17/20",
        url: "https://example.com",
        when: new Date().toISOString(),
      },
    ],
    diff_desde_label: "hace 6h",
    authed: true,
    ...overrides,
  };
}

describe("renderPanorama", () => {
  test("contains date header", () => {
    const out = renderPanorama(makePanorama(), { color: false });
    expect(out).toContain("Hoy — Lunes 27 abril 2026");
  });

  test("contains Ahora block", () => {
    const out = renderPanorama(makePanorama(), { color: false });
    expect(out).toContain("AC6M28");
    expect(out).toContain("CIENCIA Y DESCUBRIMIENTO");
  });

  test("contains Proximo block with eta", () => {
    const out = renderPanorama(makePanorama(), { color: false });
    expect(out).toContain("FB6M4");
    expect(out).toContain("1h 23m");
  });

  test("contains pendiente section", () => {
    const out = renderPanorama(makePanorama(), { color: false });
    expect(out).toContain("Pendiente hoy");
    expect(out).toContain("ENTREGA");
    expect(out).toContain("Informe semanal UD2");
  });

  test("contains esta semana summary", () => {
    const out = renderPanorama(makePanorama(), { color: false });
    expect(out).toContain("3 tareas");
    expect(out).toContain("2 quizzes");
  });

  test("contains cambios section", () => {
    const out = renderPanorama(makePanorama(), { color: false });
    expect(out).toContain("Cambios");
    expect(out).toContain("Nueva calificación");
    expect(out).toContain("Práctica calificada 1");
    expect(out).toContain("17/20");
  });

  test("no-auth shows login hint", () => {
    const out = renderPanorama(makePanorama({ authed: false }), { color: false });
    expect(out).toContain("No autenticado");
    expect(out).toContain("wiener auth login");
    expect(out).toContain("wiener auth canvas pat new");
  });

  test("empty pendiente shows nada pendiente", () => {
    const out = renderPanorama(makePanorama({ pendiente_hoy: [] }), { color: false });
    expect(out).toContain("Nada pendiente hoy");
  });

  test("no diff items skips cambios section", () => {
    const out = renderPanorama(makePanorama({ diff_items: [] }), { color: false });
    expect(out).not.toContain("Cambios desde");
  });

  test("color mode outputs bold escape codes when enabled", () => {
    const out = renderPanorama(makePanorama(), { color: true });
    expect(out.length).toBeGreaterThan(100);
  });
});
