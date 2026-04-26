import { describe, expect, mock, test } from "bun:test";

mock.module("../../src/lib/api/intranet/horario.js", () => ({
  getHorarioMatriculado: async () => ({
    semana: "2026-I",
    dias: {
      L: [
        {
          time_start: "07:00",
          time_end: "10:00",
          course_code: "AC6M28",
          course_name: "CIENCIA Y DESCUBRIMIENTO",
          section: "T",
          type: "Remoto-Videoconf",
          room: "Virtual",
          building: "Online",
          teacher: "Pérez",
        },
      ],
    },
  }),
}));

mock.module("../../src/lib/api/canvas/courses.js", () => ({
  getActiveCourses: async () => [
    {
      code: "AC6M28",
      name: "CIENCIA Y DESCUBRIMIENTO",
      alias: "ciencia",
      secciones: [{ id: 100, seccion: "T", name: "CIENCIA - T" }],
    },
  ],
}));

mock.module("../../src/lib/api/canvas/calendar.js", () => ({
  getUpcomingEvents: async () => [],
  getTodo: async () => [],
}));

mock.module("../../src/lib/api/canvas/announcements.js", () => ({
  getAnnouncements: async () => [],
}));

mock.module("../../src/lib/api/canvas/files.js", () => ({
  listAllFiles: async () => [],
}));

mock.module("../../src/lib/api/canvas/submissions.js", () => ({
  getMySubmissions: async () => [],
}));

mock.module("../../src/lib/api/canvas/modules.js", () => ({
  getModulesWithItems: async () => [],
}));

import { buildPanorama } from "../../src/lib/workflows/panorama.js";

describe("buildPanorama (mocked)", () => {
  test("returns authed panorama with fecha_label", async () => {
    const p = await buildPanorama({ noUpdateState: true });
    expect(p.authed).toBe(true);
    expect(p.fecha_label).toBeTruthy();
    expect(typeof p.fecha_label).toBe("string");
  });

  test("pendiente_hoy is empty when no events", async () => {
    const p = await buildPanorama({ noUpdateState: true });
    expect(p.pendiente_hoy).toEqual([]);
  });

  test("esta_semana has zero counts when no events", async () => {
    const p = await buildPanorama({ noUpdateState: true });
    expect(p.esta_semana.tareas_count).toBe(0);
    expect(p.esta_semana.quizzes_count).toBe(0);
  });

  test("diff_items is array", async () => {
    const p = await buildPanorama({ noUpdateState: true });
    expect(Array.isArray(p.diff_items)).toBe(true);
  });
});
