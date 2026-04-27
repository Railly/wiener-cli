import { describe, expect, it } from "bun:test";
import type { CapabilityMap, CapabilityStatus } from "../../src/lib/canvas/probe-capabilities.js";

type CapRow = {
  label: string;
  status: CapabilityStatus;
  note: string;
  workaround?: string;
};

function buildCapRows(caps: CapabilityMap): CapRow[] {
  return [
    {
      label: "cursos, tareas, calificaciones, módulos",
      status: "ok",
      note: "accesibles",
    },
    {
      label: "anuncios",
      status: caps.anuncios === "restricted" ? "restricted" : "ok",
      note: caps.anuncios === "restricted" ? "restringido" : "accesible (endpoint global)",
    },
    {
      label: "syllabus (via course details)",
      status: caps.syllabus === "restricted" ? "restricted" : "ok",
      note: caps.syllabus === "restricted" ? "restringido" : "accesible",
    },
    {
      label: "archivos directos (/files)",
      status: caps.files,
      note:
        caps.files === "restricted"
          ? "restringido por Wiener"
          : caps.files === "ok"
            ? "accesible"
            : "desconocido",
      workaround:
        caps.files === "restricted"
          ? "wiener archivos <ref> usa módulos automáticamente"
          : undefined,
    },
    {
      label: "rubrics",
      status: caps.rubrics,
      note:
        caps.rubrics === "restricted"
          ? "restringidos"
          : caps.rubrics === "ok"
            ? "accesibles"
            : "desconocido",
      workaround:
        caps.rubrics === "restricted"
          ? "wiener tareas info omite rubric automáticamente"
          : undefined,
    },
    {
      label: "pages/quizzes/conferences",
      status: "disabled",
      note: "feature deshabilitada (per curso)",
    },
  ];
}

describe("doctor capabilities matrix", () => {
  it("shows restricted archivos and rubrics when both are blocked", () => {
    const caps: CapabilityMap = {
      files: "restricted",
      rubrics: "restricted",
      anuncios: "ok",
      syllabus: "ok",
      pages: "disabled",
      quizzes: "disabled",
      conferences: "disabled",
      probed_at: new Date().toISOString(),
    };

    const rows = buildCapRows(caps);

    const filesRow = rows.find((r) => r.label.includes("archivos directos"));
    expect(filesRow?.status).toBe("restricted");
    expect(filesRow?.workaround).toContain("módulos");

    const rubricsRow = rows.find((r) => r.label === "rubrics");
    expect(rubricsRow?.status).toBe("restricted");
    expect(rubricsRow?.workaround).toContain("omite rubric");
  });

  it("shows ok for archivos when not restricted", () => {
    const caps: CapabilityMap = {
      files: "ok",
      rubrics: "ok",
      anuncios: "ok",
      syllabus: "ok",
      pages: "disabled",
      quizzes: "disabled",
      conferences: "disabled",
      probed_at: new Date().toISOString(),
    };

    const rows = buildCapRows(caps);
    const filesRow = rows.find((r) => r.label.includes("archivos directos"));
    expect(filesRow?.status).toBe("ok");
    expect(filesRow?.workaround).toBeUndefined();
  });

  it("pages/quizzes/conferences always show as disabled", () => {
    const caps: CapabilityMap = {
      files: "ok",
      rubrics: "ok",
      anuncios: "ok",
      syllabus: "ok",
      pages: "disabled",
      quizzes: "disabled",
      conferences: "disabled",
      probed_at: new Date().toISOString(),
    };

    const rows = buildCapRows(caps);
    const pqcRow = rows.find((r) => r.label.includes("pages/quizzes"));
    expect(pqcRow?.status).toBe("disabled");
    expect(pqcRow?.note).toContain("per curso");
  });

  it("anuncios shows restricted status correctly", () => {
    const caps: CapabilityMap = {
      files: "ok",
      rubrics: "ok",
      anuncios: "restricted",
      syllabus: "ok",
      pages: "disabled",
      quizzes: "disabled",
      conferences: "disabled",
      probed_at: new Date().toISOString(),
    };

    const rows = buildCapRows(caps);
    const anunciosRow = rows.find((r) => r.label === "anuncios");
    expect(anunciosRow?.status).toBe("restricted");
  });

  it("all rows have required fields", () => {
    const caps: CapabilityMap = {
      files: "restricted",
      rubrics: "restricted",
      anuncios: "ok",
      syllabus: "ok",
      pages: "disabled",
      quizzes: "disabled",
      conferences: "disabled",
      probed_at: new Date().toISOString(),
    };

    const rows = buildCapRows(caps);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(typeof row.label).toBe("string");
      expect(typeof row.status).toBe("string");
      expect(typeof row.note).toBe("string");
    }
  });
});
