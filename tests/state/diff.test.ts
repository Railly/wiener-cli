import { describe, expect, test } from "bun:test";
import {
  type CurrentData,
  buildSnapshotsFromCurrent,
  computeDiff,
} from "../../src/lib/state/diff.js";
import { EMPTY_SNAPSHOTS } from "../../src/lib/state/snapshot.js";
import type { StateSnapshots } from "../../src/types/state.js";

const COURSES = [
  {
    code: "AC6M28",
    name: "CIENCIA Y DESCUBRIMIENTO",
    alias: "ciencia",
    secciones: [{ id: 100, seccion: "T", name: "CIENCIA - T" }],
  },
  {
    code: "FB6N1",
    name: "TERAPÉUTICA",
    alias: "terapeutica",
    secciones: [{ id: 101, seccion: "T", name: "FB6N1-T" }],
  },
];

const NOW = new Date().toISOString();

function makeCurrentData(overrides: Partial<CurrentData> = {}): CurrentData {
  return {
    anuncios: [],
    archivos: new Map(),
    submissions: [],
    modules: new Map(),
    courses: COURSES,
    ...overrides,
  };
}

describe("computeDiff — anuncio", () => {
  test("new announcement emits anuncio delta", () => {
    const data = makeCurrentData({
      anuncios: [
        {
          id: 5001,
          context_code: "course_100",
          title: "Cambio de aula",
          message: "",
          posted_at: NOW,
          html_url: "https://example.com/ann/5001",
        },
      ],
    });
    const after = buildSnapshotsFromCurrent(data);
    const items = computeDiff(EMPTY_SNAPSHOTS, after, data);
    expect(items).toHaveLength(1);
    expect(items[0]?.tipo).toBe("anuncio");
    expect(items[0]?.titulo).toBe("Cambio de aula");
    expect(items[0]?.curso).toBe("AC6M28");
  });

  test("same announcement id does not re-emit", () => {
    const before: StateSnapshots = {
      ...EMPTY_SNAPSHOTS,
      anuncios: { by_course: { "100": { last_id: "5001", last_posted_at: NOW } } },
    };
    const data = makeCurrentData({
      anuncios: [
        {
          id: 5001,
          context_code: "course_100",
          title: "Cambio de aula",
          message: "",
          posted_at: NOW,
          html_url: "",
        },
      ],
    });
    const after = buildSnapshotsFromCurrent(data);
    const items = computeDiff(before, after, data);
    expect(items).toHaveLength(0);
  });
});

describe("computeDiff — archivo", () => {
  test("new file emits archivo delta", () => {
    const file = {
      id: 9001,
      filename: "clase01.pdf",
      display_name: "clase01.pdf",
      size: 1_000_000,
      content_type: "application/pdf",
      updated_at: NOW,
      url: "https://example.com/files/9001/download",
      folder_id: 1,
    };
    const archivos = new Map([[100, [file]]]);
    const data = makeCurrentData({ archivos });
    const after = buildSnapshotsFromCurrent(data);
    const items = computeDiff(EMPTY_SNAPSHOTS, after, data);
    expect(items).toHaveLength(1);
    expect(items[0]?.tipo).toBe("archivo");
    expect(items[0]?.titulo).toBe("clase01.pdf");
  });

  test("same file id does not re-emit", () => {
    const file = {
      id: 9001,
      filename: "clase01.pdf",
      display_name: "clase01.pdf",
      size: 1_000_000,
      content_type: "application/pdf",
      updated_at: NOW,
      url: "",
      folder_id: 1,
    };
    const before: StateSnapshots = {
      ...EMPTY_SNAPSHOTS,
      archivos: {
        by_course: {
          "100": { last_modified_at: NOW, file_ids: ["9001"] },
        },
      },
    };
    const archivos = new Map([[100, [file]]]);
    const data = makeCurrentData({ archivos });
    const after = buildSnapshotsFromCurrent(data);
    const items = computeDiff(before, after, data);
    expect(items).toHaveLength(0);
  });
});

describe("computeDiff — calificacion", () => {
  test("new graded assignment emits calificacion delta", () => {
    const sub = {
      assignment_id: 2001,
      course_id: 100,
      score: 18,
      grade: "18",
      submitted_at: NOW,
      graded_at: NOW,
      workflow_state: "graded",
      assignment: {
        id: 2001,
        course_id: 100,
        name: "Práctica 1",
        due_at: null,
        points_possible: 20,
        submission_types: ["online_upload"],
        html_url: "https://example.com/assignments/2001",
      },
    };
    const data = makeCurrentData({ submissions: [sub] });
    const after = buildSnapshotsFromCurrent(data);
    const items = computeDiff(EMPTY_SNAPSHOTS, after, data);
    expect(items).toHaveLength(1);
    expect(items[0]?.tipo).toBe("calificacion");
    expect(items[0]?.detalle).toBe("18/20");
    expect(items[0]?.curso).toBe("AC6M28");
  });

  test("score change emits calificacion delta with transition", () => {
    const before: StateSnapshots = {
      ...EMPTY_SNAPSHOTS,
      calificaciones: {
        by_assignment: { "2001": { score: 15, graded_at: NOW } },
      },
    };
    const sub = {
      assignment_id: 2001,
      course_id: 100,
      score: 18,
      grade: "18",
      submitted_at: NOW,
      graded_at: NOW,
      workflow_state: "graded",
      assignment: {
        id: 2001,
        course_id: 100,
        name: "Práctica 1",
        due_at: null,
        points_possible: 20,
        submission_types: ["online_upload"],
        html_url: "",
      },
    };
    const data = makeCurrentData({ submissions: [sub] });
    const after = buildSnapshotsFromCurrent(data);
    const items = computeDiff(before, after, data);
    expect(items).toHaveLength(1);
    expect(items[0]?.detalle).toBe("15 → 18/20");
  });

  test("same score does not re-emit", () => {
    const before: StateSnapshots = {
      ...EMPTY_SNAPSHOTS,
      calificaciones: {
        by_assignment: { "2001": { score: 18, graded_at: NOW } },
      },
    };
    const sub = {
      assignment_id: 2001,
      course_id: 100,
      score: 18,
      grade: "18",
      submitted_at: NOW,
      graded_at: NOW,
      workflow_state: "graded",
    };
    const data = makeCurrentData({ submissions: [sub] });
    const after = buildSnapshotsFromCurrent(data);
    const items = computeDiff(before, after, data);
    expect(items).toHaveLength(0);
  });

  test("null score does not emit delta", () => {
    const sub = {
      assignment_id: 2002,
      course_id: 100,
      score: null,
      grade: null,
      submitted_at: null,
      graded_at: null,
      workflow_state: "submitted",
    };
    const data = makeCurrentData({ submissions: [sub] });
    const after = buildSnapshotsFromCurrent(data);
    const items = computeDiff(EMPTY_SNAPSHOTS, after, data);
    expect(items).toHaveLength(0);
  });
});

describe("computeDiff — modulo", () => {
  test("new module items emit modulo delta", () => {
    const mods = [{ id: 3001, name: "Semana 1", items_count: 5, items: [] }];
    const before: StateSnapshots = {
      ...EMPTY_SNAPSHOTS,
      modulos: { by_course: { "100": { items_count: 3 } } },
    };
    const modules = new Map([[100, mods]]);
    const data = makeCurrentData({ modules });
    const after = buildSnapshotsFromCurrent(data);
    const items = computeDiff(before, after, data);
    expect(items).toHaveLength(1);
    expect(items[0]?.tipo).toBe("modulo");
    expect(items[0]?.titulo).toContain("2 items nuevos");
  });

  test("no module change does not emit", () => {
    const mods = [{ id: 3001, name: "Semana 1", items_count: 5, items: [] }];
    const before: StateSnapshots = {
      ...EMPTY_SNAPSHOTS,
      modulos: { by_course: { "100": { items_count: 5 } } },
    };
    const modules = new Map([[100, mods]]);
    const data = makeCurrentData({ modules });
    const after = buildSnapshotsFromCurrent(data);
    const items = computeDiff(before, after, data);
    expect(items).toHaveLength(0);
  });
});

describe("computeDiff — multiple tipos", () => {
  test("multiple changes emit multiple deltas", () => {
    const ann = {
      id: 6001,
      context_code: "course_100",
      title: "Nuevo aviso",
      message: "",
      posted_at: NOW,
      html_url: "",
    };
    const file = {
      id: 9002,
      filename: "t2.pdf",
      display_name: "t2.pdf",
      size: 500_000,
      content_type: "application/pdf",
      updated_at: NOW,
      url: "",
      folder_id: 1,
    };
    const archivos = new Map([[100, [file]]]);
    const data = makeCurrentData({ anuncios: [ann], archivos });
    const after = buildSnapshotsFromCurrent(data);
    const items = computeDiff(EMPTY_SNAPSHOTS, after, data);
    expect(items.length).toBeGreaterThanOrEqual(2);
    const tipos = items.map((i) => i.tipo);
    expect(tipos).toContain("anuncio");
    expect(tipos).toContain("archivo");
  });
});
