import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { atomicWriteJson } from "../foundation/atomic-write.js";
import type { StateSnapshots, WienerState } from "../../types/state.js";

export const EMPTY_SNAPSHOTS: StateSnapshots = {
  anuncios: { by_course: {} },
  archivos: { by_course: {} },
  calificaciones: { by_assignment: {} },
  tareas: { by_course: {} },
  modulos: { by_course: {} },
};

function statePath(profile = "default"): string {
  const dir = join(homedir(), ".wiener");
  return join(dir, profile === "default" ? "state.json" : `state-${profile}.json`);
}

export function loadState(profile = "default"): WienerState | null {
  const path = statePath(profile);
  if (!existsSync(path)) return null;
  try {
    const raw = readFileSync(path, "utf-8").trim();
    if (!raw) return null;
    return JSON.parse(raw) as WienerState;
  } catch {
    return null;
  }
}

export function saveState(state: WienerState, profile = "default"): void {
  const dir = join(homedir(), ".wiener");
  mkdirSync(dir, { recursive: true });
  atomicWriteJson(statePath(profile), state);
}

export function isStateStale(state: WienerState, maxAgeHours: number): boolean {
  const last = new Date(state.last_run_at).getTime();
  const ageHours = (Date.now() - last) / 3600000;
  return ageHours > maxAgeHours;
}

export function stateAgeLabel(state: WienerState): string {
  const diffMs = Date.now() - new Date(state.last_run_at).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `hace ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `hace ${days}d`;
}
