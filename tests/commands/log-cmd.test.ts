import { describe, expect, it } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { tailAudit } from "../../src/lib/foundation/audit-log.js";

function makeAuditDir(): string {
  const dir = join(tmpdir(), `wiener-log-test-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("tailAudit", () => {
  it("returns empty array for missing dir", () => {
    const result = tailAudit("/nonexistent/path/xyz", 10);
    expect(result).toBeArray();
    expect(result.length).toBe(0);
  });

  it("reads records from jsonl files", () => {
    const dir = makeAuditDir();
    const today = new Date().toISOString().slice(0, 10);
    const file = join(dir, `${today}.jsonl`);
    const record = {
      ts: new Date().toISOString(),
      kind: "archivos download",
      command: "archivos download",
      result: "ok",
      tier: "T0",
      profile: "default",
    };
    writeFileSync(file, `${JSON.stringify(record)}\n`);

    const result = tailAudit(dir, 5);
    expect(result.length).toBe(1);
    expect(result[0]?.command).toBe("archivos download");
    expect(result[0]?.result).toBe("ok");
  });

  it("respects limit parameter", () => {
    const dir = makeAuditDir();
    const today = new Date().toISOString().slice(0, 10);
    const file = join(dir, `${today}.jsonl`);
    const lines = Array.from({ length: 10 }, (_, i) =>
      JSON.stringify({
        ts: new Date(Date.now() - i * 1000).toISOString(),
        kind: "test",
        command: `cmd-${i}`,
        result: "ok",
        tier: "T0",
        profile: "default",
      }),
    ).join("\n");
    writeFileSync(file, `${lines}\n`);

    const result = tailAudit(dir, 3);
    expect(result.length).toBe(3);
  });

  it("returns records in reverse chronological order", () => {
    const dir = makeAuditDir();
    const today = new Date().toISOString().slice(0, 10);
    const file = join(dir, `${today}.jsonl`);
    const older = new Date(Date.now() - 60000).toISOString();
    const newer = new Date().toISOString();
    writeFileSync(
      file,
      [
        JSON.stringify({
          ts: older,
          kind: "old",
          command: "old-cmd",
          result: "ok",
          tier: "T0",
          profile: "default",
        }),
        JSON.stringify({
          ts: newer,
          kind: "new",
          command: "new-cmd",
          result: "ok",
          tier: "T0",
          profile: "default",
        }),
      ].join("\n") + "\n",
    );

    const result = tailAudit(dir, 10);
    expect(result[0]?.command).toBe("new-cmd");
    expect(result[1]?.command).toBe("old-cmd");
  });
});

describe("since period parsing", () => {
  function parseSinceDays(since: string | undefined): number {
    if (!since) return 1;
    const m = /^(\d+)d$/.exec(since);
    if (m?.[1]) return Number.parseInt(m[1], 10);
    const h = /^(\d+)h$/.exec(since);
    if (h?.[1]) return Number.parseInt(h[1], 10) / 24;
    return 1;
  }

  it("parses 7d as 7 days", () => {
    expect(parseSinceDays("7d")).toBe(7);
  });

  it("parses 24h as 1 day", () => {
    expect(parseSinceDays("24h")).toBe(1);
  });

  it("defaults to 1 for unknown format", () => {
    expect(parseSinceDays(undefined)).toBe(1);
    expect(parseSinceDays("invalid")).toBe(1);
  });
});
