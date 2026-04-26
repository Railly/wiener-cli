import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const FIXTURES_DIR = join(import.meta.dir, "../fixtures");

describe("planner items fixture", () => {
  it("has expected shape", () => {
    const items = JSON.parse(
      readFileSync(join(FIXTURES_DIR, "canvas-planner-items.json"), "utf-8")
    ) as Array<Record<string, unknown>>;

    expect(items).toBeArray();
    expect(items.length).toBe(2);

    const first = items[0] as Record<string, unknown>;
    expect(first["plannable_type"]).toBe("assignment");
    expect(first["plannable_date"]).toBeString();
    expect(first["plannable"]).toBeDefined();
  });

  it("planner items have course_id", () => {
    const items = JSON.parse(
      readFileSync(join(FIXTURES_DIR, "canvas-planner-items.json"), "utf-8")
    ) as Array<Record<string, unknown>>;

    for (const item of items) {
      expect(item["course_id"]).toBeNumber();
    }
  });

  it("planner items have plannable with title and due_at", () => {
    const items = JSON.parse(
      readFileSync(join(FIXTURES_DIR, "canvas-planner-items.json"), "utf-8")
    ) as Array<Record<string, unknown>>;

    for (const item of items) {
      const plannable = item["plannable"] as Record<string, unknown>;
      expect(plannable["title"]).toBeString();
      expect(plannable["due_at"]).toBeString();
    }
  });

  it("new_activity field exists", () => {
    const items = JSON.parse(
      readFileSync(join(FIXTURES_DIR, "canvas-planner-items.json"), "utf-8")
    ) as Array<Record<string, unknown>>;

    for (const item of items) {
      expect(typeof item["new_activity"]).toBe("boolean");
    }
  });
});
