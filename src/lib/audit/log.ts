import { getWienerPaths } from "../foundation/xdg-paths.js";
import { audit } from "../foundation/audit-log.js";

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
  [key: string]: unknown;
}

export function auditLog(entry: AuditEntry): void {
  try {
    const paths = getWienerPaths();
    const { ts: _ts, command, result, trust, profile, ...rest } = entry;
    audit(paths.audit, {
      kind: command,
      command,
      result: (result ?? "ok") as "ok" | "error" | "blocked" | "dry-run",
      tier: trust,
      profile,
      meta: rest,
    });
  } catch {
    // Audit log failure is non-fatal
  }
}

export function shouldAudit(trust: TrustLevel, verbose: boolean): boolean {
  if (trust === "T2") return true;
  if (verbose) return true;
  return false;
}
