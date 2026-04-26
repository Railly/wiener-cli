import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { getConfigDir } from "../env.js";

export type TrustLevel = "T0" | "T2";

export interface AuditEntry {
  ts: string;
  command: string;
  trust: TrustLevel;
  profile: string;
  args?: Record<string, unknown>;
  result?: "ok" | "error";
  error_code?: string;
  duration_ms?: number;
}

export function auditLog(entry: AuditEntry): void {
  try {
    const dir = getConfigDir();
    mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, "audit.jsonl");
    const line = `${JSON.stringify({ ...entry, ts: entry.ts ?? new Date().toISOString() })}\n`;
    appendFileSync(filePath, line, "utf-8");
  } catch {
    // Audit log failure is non-fatal
  }
}

export function shouldAudit(trust: TrustLevel, verbose: boolean): boolean {
  if (trust === "T2") return true;
  if (verbose) return true;
  return false;
}
