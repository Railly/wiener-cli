// cligentic block: audit-log (adapted for wiener-cli)
// Append-only JSONL audit trail with daily file rotation.

import { appendFileSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type AuditRecord = {
  kind: string;
  command: string;
  result: "ok" | "error" | "blocked" | "dry-run";
  meta?: Record<string, unknown>;
  tier?: string;
  profile?: string;
};

type StoredRecord = AuditRecord & {
  ts: string;
};

function todayFilename(): string {
  return `${new Date().toISOString().slice(0, 10)}.jsonl`;
}

export function audit(auditDir: string, record: AuditRecord): void {
  mkdirSync(auditDir, { recursive: true });
  const file = join(auditDir, todayFilename());
  const stored: StoredRecord = { ts: new Date().toISOString(), ...record };
  appendFileSync(file, `${JSON.stringify(stored)}\n`, { mode: 0o600 });
}

export function tailAudit(auditDir: string, n = 20): StoredRecord[] {
  let files: string[];
  try {
    files = readdirSync(auditDir)
      .filter((f) => f.endsWith(".jsonl"))
      .sort()
      .reverse();
  } catch {
    return [];
  }

  const results: StoredRecord[] = [];
  for (const file of files) {
    if (results.length >= n) break;
    try {
      const content = readFileSync(join(auditDir, file), "utf8");
      const lines = content.trim().split("\n").filter(Boolean).reverse();
      for (const line of lines) {
        if (results.length >= n) break;
        try {
          results.push(JSON.parse(line) as StoredRecord);
        } catch {
          // skip malformed lines
        }
      }
    } catch {
      // skip unreadable files
    }
  }

  return results;
}
