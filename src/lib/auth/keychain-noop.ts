import { chmodSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getProfileDir } from "../env.js";

function sessionPath(type: "intranet" | "canvas", profile: string): string {
  return path.join(getProfileDir(profile), `${type}-session.json`);
}

export function fileSet(type: "intranet" | "canvas", profile: string, value: string): void {
  const dir = getProfileDir(profile);
  mkdirSync(dir, { recursive: true });
  const fp = sessionPath(type, profile);
  writeFileSync(fp, value, "utf-8");
  try {
    chmodSync(fp, 0o600);
  } catch {
    // Best-effort chmod
  }
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
