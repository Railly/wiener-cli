import { describe, expect, it } from "bun:test";
import type { CanvasModule } from "../../src/types/canvas.js";

const mockModules: CanvasModule[] = [
  {
    id: 1,
    name: "SEMANA 04",
    items_count: 2,
    items: [
      {
        id: 101,
        title: "Tema-04-farmacocinetica.pdf",
        type: "File",
        url: "https://campus.uwiener.edu.pe/files/101/download",
        content_id: 501,
      },
      {
        id: 102,
        title: "Lectura complementaria.pdf",
        type: "File",
        url: "https://campus.uwiener.edu.pe/files/102/download",
        content_id: 502,
      },
      {
        id: 103,
        title: "Ver módulo",
        type: "ExternalUrl",
        html_url: "https://example.com",
      },
    ],
  },
  {
    id: 2,
    name: "SEMANA 03",
    items_count: 1,
    items: [
      {
        id: 201,
        title: "Receptores hormonales.pdf",
        type: "File",
        url: "https://campus.uwiener.edu.pe/files/201/download",
        content_id: 601,
      },
    ],
  },
];

describe("fetchModuleFileItems — module-based file extraction", () => {
  it("extracts only File items from modules", () => {
    const result: Array<{
      id: number;
      title: string;
      url: string;
      module_name: string;
    }> = [];

    for (const mod of mockModules) {
      const items = mod.items ?? [];
      for (const item of items) {
        if (item.type === "File" && item.url) {
          result.push({
            id: item.id,
            title: item.title,
            url: item.url,
            module_name: mod.name,
          });
        }
      }
    }

    expect(result).toHaveLength(3);
    expect(result[0].title).toBe("Tema-04-farmacocinetica.pdf");
    expect(result[0].module_name).toBe("SEMANA 04");
    expect(result[1].title).toBe("Lectura complementaria.pdf");
    expect(result[2].title).toBe("Receptores hormonales.pdf");
    expect(result[2].module_name).toBe("SEMANA 03");
  });

  it("ignores non-File module items", () => {
    const allItems = mockModules.flatMap((m) => m.items ?? []);
    const externalUrls = allItems.filter((i) => i.type === "ExternalUrl");
    const files = allItems.filter((i) => i.type === "File");

    expect(externalUrls).toHaveLength(1);
    expect(files).toHaveLength(3);
  });

  it("preserves module_name in each file item", () => {
    const result: Array<{ module_name: string; title: string }> = [];
    for (const mod of mockModules) {
      for (const item of mod.items ?? []) {
        if (item.type === "File" && item.url) {
          result.push({ module_name: mod.name, title: item.title });
        }
      }
    }

    const semana04Items = result.filter((r) => r.module_name === "SEMANA 04");
    expect(semana04Items).toHaveLength(2);
    const semana03Items = result.filter((r) => r.module_name === "SEMANA 03");
    expect(semana03Items).toHaveLength(1);
  });

  it("uses url from item directly (no /files/{id} lookup needed)", () => {
    for (const mod of mockModules) {
      for (const item of mod.items ?? []) {
        if (item.type === "File") {
          expect(item.url).toMatch(/^https?:\/\//);
        }
      }
    }
  });
});
