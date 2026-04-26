import { describe, test, expect } from "bun:test";
import { renderNuevo } from "../../src/lib/output/nuevo-renderer.js";
import type { DeltaItem } from "../../src/lib/state/diff.js";

const NOW = new Date().toISOString();

function makeItem(tipo: DeltaItem["tipo"], overrides: Partial<DeltaItem> = {}): DeltaItem {
  return {
    tipo,
    curso: "AC6M28",
    titulo: "Test title",
    detalle: "test detail",
    url: "https://example.com",
    when: NOW,
    ...overrides,
  };
}

describe("renderNuevo", () => {
  test("empty items shows sin cambios", () => {
    const out = renderNuevo([], { color: false, desde: null });
    expect(out).toContain("Sin cambios");
  });

  test("shows desde header when desde provided", () => {
    const items = [makeItem("anuncio")];
    const desde = "2026-04-26T12:00:00Z";
    const out = renderNuevo(items, { color: false, desde });
    expect(out).toContain("Cambios desde");
  });

  test("renders each tipo correctly", () => {
    const tipos: DeltaItem["tipo"][] = ["anuncio", "archivo", "calificacion", "tarea", "modulo"];
    for (const tipo of tipos) {
      const out = renderNuevo([makeItem(tipo, { titulo: `Item ${tipo}` })], {
        color: false,
        desde: null,
      });
      expect(out).toContain(`Item ${tipo}`);
    }
  });

  test("shows ✦ icon for each item", () => {
    const items = [makeItem("calificacion"), makeItem("archivo")];
    const out = renderNuevo(items, { color: false, desde: null });
    const count = (out.match(/✦/g) ?? []).length;
    expect(count).toBe(2);
  });

  test("shows wiener nuevo --abrir hint", () => {
    const items = [makeItem("anuncio")];
    const out = renderNuevo(items, { color: false, desde: null });
    expect(out).toContain("wiener nuevo --abrir");
  });

  test("renders curso code", () => {
    const items = [makeItem("anuncio", { curso: "FB6N2" })];
    const out = renderNuevo(items, { color: false, desde: null });
    expect(out).toContain("FB6N2");
  });
});
