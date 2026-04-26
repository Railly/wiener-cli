import { describe, test, expect, mock, spyOn } from "bun:test";
import type { DeltaItem } from "../../src/lib/state/diff.js";

const NOW = new Date().toISOString();

function makeItem(titulo: string): DeltaItem {
  return {
    tipo: "anuncio",
    curso: "AC6M28",
    titulo,
    detalle: "",
    url: "https://example.com",
    when: NOW,
  };
}

describe("notifyMacos", () => {
  test("does nothing when items is empty", async () => {
    const spawned: string[][] = [];
    const originalSpawn = Bun.spawn;
    (Bun as { spawn: unknown }).spawn = (cmd: string[]) => {
      spawned.push(cmd);
      return { exited: Promise.resolve(0) };
    };
    const { notifyMacos } = await import("../../src/lib/notify/macos.js");
    await notifyMacos([]);
    expect(spawned).toHaveLength(0);
    (Bun as { spawn: unknown }).spawn = originalSpawn;
  });

  test("spawns osascript with single item title", async () => {
    const spawned: string[][] = [];
    const originalSpawn = Bun.spawn;
    (Bun as { spawn: unknown }).spawn = (cmd: string[], _opts: unknown) => {
      spawned.push(cmd as string[]);
      return { exited: Promise.resolve(0) };
    };
    const { notifyMacos } = await import("../../src/lib/notify/macos.js");
    await notifyMacos([makeItem("Clase cancelada")]);
    expect(spawned.length).toBeGreaterThanOrEqual(1);
    const last = spawned[spawned.length - 1]!;
    expect(last[0]).toBe("osascript");
    expect(last.join(" ")).toContain("Clase cancelada");
    (Bun as { spawn: unknown }).spawn = originalSpawn;
  });

  test("spawns osascript with count message for multiple items", async () => {
    const spawned: string[][] = [];
    const originalSpawn = Bun.spawn;
    (Bun as { spawn: unknown }).spawn = (cmd: string[], _opts: unknown) => {
      spawned.push(cmd as string[]);
      return { exited: Promise.resolve(0) };
    };
    const { notifyMacos } = await import("../../src/lib/notify/macos.js");
    await notifyMacos([makeItem("A"), makeItem("B"), makeItem("C")]);
    const last = spawned[spawned.length - 1]!;
    expect(last.join(" ")).toContain("3 cambios");
    (Bun as { spawn: unknown }).spawn = originalSpawn;
  });
});
