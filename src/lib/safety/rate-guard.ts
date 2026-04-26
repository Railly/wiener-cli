import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { WienerError } from "../errors.ts";

interface LastAction {
  ts: string;
}

function stateDir(profile = "default"): string {
  return join(homedir(), ".wiener", profile);
}

function lastFile(cmd: string, profile = "default"): string {
  return join(stateDir(profile), `${cmd}-last.json`);
}

/**
 * Enforces a minimum gap between invocations of a T2 mutation command.
 * Throws rate-limited if called twice within `windowMs`.
 * Call `markUsed` AFTER a successful action.
 */
export function checkRateGuard(cmd: string, windowMs: number, profile = "default"): void {
  const file = lastFile(cmd, profile);
  if (!existsSync(file)) return;

  try {
    const raw = readFileSync(file, "utf-8");
    const { ts } = JSON.parse(raw) as LastAction;
    const elapsed = Date.now() - new Date(ts).getTime();
    if (elapsed < windowMs) {
      const remainingSecs = Math.ceil((windowMs - elapsed) / 1000);
      throw new WienerError(
        "rate-limited",
        `Too many ${cmd} invocations. Wait ${remainingSecs}s before trying again.`,
        `This guard prevents accidental duplicate ${cmd} actions.`,
      );
    }
  } catch (e) {
    if (e instanceof WienerError) throw e;
    // Corrupt file — ignore and allow
  }
}

export function markRateGuardUsed(cmd: string, profile = "default"): void {
  const dir = stateDir(profile);
  mkdirSync(dir, { recursive: true });
  const entry: LastAction = { ts: new Date().toISOString() };
  writeFileSync(lastFile(cmd, profile), JSON.stringify(entry), "utf-8");
}
