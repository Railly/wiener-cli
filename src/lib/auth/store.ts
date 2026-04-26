// PHASE A WILL REPLACE — stub for Phase D
import { homedir } from "os";
import { join } from "path";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";

export interface IntranetSession {
  aspCookieName: string;
  aspCookieValue: string;
  perfil: string;
  capturedAt: string;
  codigo: string;
}

export interface CanvasSession {
  token: string;
  validatedAt: string;
  userId: number;
  primaryEmail?: string;
}

function wienerDir(): string {
  return join(homedir(), ".wiener");
}

function sessionPath(type: "intranet" | "canvas", profile = "default"): string {
  return join(wienerDir(), profile, `${type}-session.json`);
}

export function loadIntranetSession(profile = "default"): IntranetSession | null {
  const path = sessionPath("intranet", profile);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as IntranetSession;
  } catch {
    return null;
  }
}

export function saveIntranetSession(session: IntranetSession, profile = "default"): void {
  const path = sessionPath("intranet", profile);
  mkdirSync(join(wienerDir(), profile), { recursive: true });
  writeFileSync(path, JSON.stringify(session, null, 2), { mode: 0o600 });
}

export function clearIntranetSession(profile = "default"): void {
  const path = sessionPath("intranet", profile);
  if (existsSync(path)) {
    writeFileSync(path, "", { mode: 0o600 });
  }
}

export function loadCanvasSession(profile = "default"): CanvasSession | null {
  const envToken = process.env.WIENER_CANVAS_TOKEN;
  if (envToken) {
    return { token: envToken, validatedAt: new Date().toISOString(), userId: 0 };
  }
  const path = sessionPath("canvas", profile);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as CanvasSession;
  } catch {
    return null;
  }
}

export function saveCanvasSession(session: CanvasSession, profile = "default"): void {
  const path = sessionPath("canvas", profile);
  mkdirSync(join(wienerDir(), profile), { recursive: true });
  writeFileSync(path, JSON.stringify(session, null, 2), { mode: 0o600 });
}

export function clearCanvasSession(profile = "default"): void {
  const path = sessionPath("canvas", profile);
  if (existsSync(path)) {
    writeFileSync(path, "", { mode: 0o600 });
  }
}
