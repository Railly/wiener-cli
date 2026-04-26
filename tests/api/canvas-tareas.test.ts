import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const FIXTURES_DIR = join(import.meta.dir, "../fixtures");

function fixtureAssignments() {
  return JSON.parse(readFileSync(join(FIXTURES_DIR, "canvas-assignments.json"), "utf-8")) as Array<
    Record<string, unknown>
  >;
}

describe("canvas assignments fixture shape", () => {
  it("fixture has expected fields", () => {
    const assignments = fixtureAssignments();
    expect(assignments).toBeArray();
    expect(assignments.length).toBeGreaterThan(0);

    const first = assignments[0] as Record<string, unknown>;
    expect(first.id).toBeNumber();
    expect(first.name).toBeString();
    expect(first.due_at).toBeString();
    expect(first.points_possible).toBeNumber();
    expect(first.submission).toBeDefined();
  });

  it("graded assignment has score and grade", () => {
    const assignments = fixtureAssignments();
    const graded = assignments.find(
      (a) => (a.submission as Record<string, unknown>)?.workflow_state === "graded",
    );
    expect(graded).toBeDefined();
    const sub = graded?.submission as Record<string, unknown>;
    expect(sub.score).toBe(17);
    expect(sub.grade).toBe("17");
  });

  it("unsubmitted assignment has missing=true", () => {
    const assignments = fixtureAssignments();
    const unsubmitted = assignments.find(
      (a) => (a.submission as Record<string, unknown>)?.workflow_state === "unsubmitted",
    );
    expect(unsubmitted).toBeDefined();
    const sub = unsubmitted?.submission as Record<string, unknown>;
    expect(sub.missing).toBe(true);
  });

  it("submitted assignment has workflow_state=submitted", () => {
    const assignments = fixtureAssignments();
    const submitted = assignments.find(
      (a) => (a.submission as Record<string, unknown>)?.workflow_state === "submitted",
    );
    expect(submitted).toBeDefined();
    const sub = submitted?.submission as Record<string, unknown>;
    expect(sub.submitted_at).toBeString();
  });

  it("all assignments have course_id 131067", () => {
    const assignments = fixtureAssignments();
    for (const a of assignments) {
      expect(a.course_id).toBe(131067);
    }
  });

  it("all assignments have html_url", () => {
    const assignments = fixtureAssignments();
    for (const a of assignments) {
      expect(a.html_url).toBeString();
    }
  });
});
