import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { canvasFetch } from "../api/canvas/client.js";
import { loadCanvasSession } from "../auth/store.js";
import { WienerFeatureDisabledError, WienerRestrictedError } from "../errors.js";

export type CapabilityStatus = "ok" | "restricted" | "disabled" | "unknown";

export interface CapabilityMap {
  files: CapabilityStatus;
  rubrics: CapabilityStatus;
  anuncios: CapabilityStatus;
  syllabus: CapabilityStatus;
  pages: CapabilityStatus;
  quizzes: CapabilityStatus;
  conferences: CapabilityStatus;
  probed_at: string;
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function capCacheDir(profile: string): string {
  const base = process.env.WIENER_CONFIG_DIR ?? join(homedir(), ".wiener");
  const dir = join(base, profile);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

function capCachePath(profile: string): string {
  return join(capCacheDir(profile), "capabilities.json");
}

function loadCachedCapabilities(profile: string): CapabilityMap | null {
  const path = capCachePath(profile);
  if (!existsSync(path)) return null;
  try {
    const raw = readFileSync(path, "utf-8");
    const parsed = JSON.parse(raw) as CapabilityMap & { _expiresAt?: number };
    const expiresAt = parsed._expiresAt ?? 0;
    if (Date.now() > expiresAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveCachedCapabilities(profile: string, caps: CapabilityMap): void {
  try {
    const path = capCachePath(profile);
    const toWrite = { ...caps, _expiresAt: Date.now() + CACHE_TTL_MS };
    writeFileSync(path, JSON.stringify(toWrite, null, 2));
  } catch {
    // non-fatal
  }
}

async function probeEndpoint(path: string, token: string): Promise<CapabilityStatus> {
  try {
    await canvasFetch(path, { token });
    return "ok";
  } catch (e) {
    if (e instanceof WienerRestrictedError) return "restricted";
    if (e instanceof WienerFeatureDisabledError) return "disabled";
    return "unknown";
  }
}

export async function probeCapabilities(profile = "default"): Promise<CapabilityMap> {
  const cached = loadCachedCapabilities(profile);
  if (cached) return cached;

  const session = await loadCanvasSession(profile);
  if (!session) {
    const ts = new Date().toISOString();
    return {
      files: "unknown",
      rubrics: "unknown",
      anuncios: "unknown",
      syllabus: "unknown",
      pages: "unknown",
      quizzes: "unknown",
      conferences: "unknown",
      probed_at: ts,
    };
  }

  const token = session.token;

  const [files, rubrics, anuncios, syllabus] = await Promise.all([
    probeEndpoint("/api/v1/courses/0/files?per_page=1", token),
    probeEndpoint("/api/v1/courses/0/rubrics?per_page=1", token),
    probeEndpoint("/api/v1/announcements?context_codes[]=course_0&per_page=1", token),
    probeEndpoint("/api/v1/courses/0?include[]=syllabus_body", token),
  ]);

  const caps: CapabilityMap = {
    files,
    rubrics,
    anuncios,
    syllabus,
    pages: "disabled",
    quizzes: "disabled",
    conferences: "disabled",
    probed_at: new Date().toISOString(),
  };

  saveCachedCapabilities(profile, caps);
  return caps;
}
