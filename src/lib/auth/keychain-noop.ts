import { existsSync, readFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import { atomicWrite } from "../foundation/atomic-write.js";
import { getProfileDir } from "../env.js";

function sessionPath(type: "intranet" | "canvas", profile: string): string {
  return path.join(getProfileDir(profile), `${type}-session.json`);
}

export function fileSet(type: "intranet" | "canvas", profile: string, value: string): void {
  const fp = sessionPath(type, profile);
  atomicWrite(fp, value, { mode: 0o600 });
  process.stderr.write(
    `[wiener-cli] Keychain unavailable; session stored in ${fp} (0600). Consider configuring macOS Keychain.\n`,
  );
}

export function fileGet(type: "intranet" | "canvas", profile: string): string | null {
  try {
    return readFileSync(sessionPath(type, profile), "utf-8").trim() || null;
  } catch {
    return null;
  }
}

export function fileDelete(type: "intranet" | "canvas", profile: string): void {
  try {
    unlinkSync(sessionPath(type, profile));
  } catch {
    // Already gone
  }
}
