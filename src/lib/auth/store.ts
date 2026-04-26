import type { CanvasSession } from "../../types/canvas.js";
import type { IntranetSession } from "../../types/intranet.js";
import { keychainDelete, keychainGet, keychainSet } from "./keychain-mac.js";
import { fileDelete, fileGet, fileSet } from "./keychain-noop.js";

const isDarwin = process.platform === "darwin";

function serviceName(type: "intranet" | "canvas", profile: string): string {
  return `wiener-cli.${type}.${profile}`;
}

const ACCOUNT = "session";

async function storageSet(
  type: "intranet" | "canvas",
  profile: string,
  value: string,
): Promise<void> {
  if (isDarwin) {
    try {
      await keychainSet(serviceName(type, profile), ACCOUNT, value);
      return;
    } catch {
      // Fall through to file
    }
  }
  fileSet(type, profile, value);
}

async function storageGet(type: "intranet" | "canvas", profile: string): Promise<string | null> {
  if (isDarwin) {
    try {
      const v = await keychainGet(serviceName(type, profile), ACCOUNT);
      if (v !== null) return v;
    } catch {
      // Fall through to file
    }
  }
  return fileGet(type, profile);
}

async function storageDelete(type: "intranet" | "canvas", profile: string): Promise<void> {
  if (isDarwin) {
    try {
      await keychainDelete(serviceName(type, profile), ACCOUNT);
    } catch {
      // Continue
    }
  }
  fileDelete(type, profile);
}

// Intranet
export async function saveIntranetSession(
  session: IntranetSession,
  profile = "default",
): Promise<void> {
  await storageSet("intranet", profile, JSON.stringify(session));
}

export async function loadIntranetSession(profile = "default"): Promise<IntranetSession | null> {
  const raw = await storageGet("intranet", profile);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as IntranetSession;
  } catch {
    return null;
  }
}

export async function wipeIntranetSession(profile = "default"): Promise<void> {
  await storageDelete("intranet", profile);
}

// Canvas
export async function saveCanvasSession(
  session: CanvasSession,
  profile = "default",
): Promise<void> {
  await storageSet("canvas", profile, JSON.stringify(session));
}

export async function loadCanvasSession(profile = "default"): Promise<CanvasSession | null> {
  const raw = await storageGet("canvas", profile);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CanvasSession;
  } catch {
    return null;
  }
}

export async function wipeCanvasSession(profile = "default"): Promise<void> {
  await storageDelete("canvas", profile);
}
