import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { atomicWriteJson } from "../foundation/atomic-write.js";
import type { AliasStore } from "../../types/course.js";
import { getConfigDir } from "../env.js";

function aliasFilePath(): string {
  return path.join(getConfigDir(), "aliases.json");
}

export function loadAliasStore(): AliasStore {
  const fp = aliasFilePath();
  if (!existsSync(fp)) return {};
  try {
    return JSON.parse(readFileSync(fp, "utf-8")) as AliasStore;
  } catch {
    return {};
  }
}

export function saveAliasStore(store: AliasStore): void {
  atomicWriteJson(aliasFilePath(), store);
}

export function getProfileAliases(profile = "default"): Record<string, string> {
  const store = loadAliasStore();
  return store[profile] ?? {};
}

export function setAlias(code: string, alias: string, profile = "default"): void {
  const store = loadAliasStore();
  if (!store[profile]) store[profile] = {};
  (store[profile] as Record<string, string>)[code] = alias;
  saveAliasStore(store);
}

export function resetAlias(code: string, profile = "default"): void {
  const store = loadAliasStore();
  if (store[profile]) {
    delete (store[profile] as Record<string, string>)[code];
    saveAliasStore(store);
  }
}
