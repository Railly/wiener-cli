import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DEFAULT_CONFIG } from "../types/config.js";
import type { WienerConfig } from "../types/config.js";
import { getConfigDir } from "./env.js";

function configFilePath(configDir?: string): string {
  return path.join(configDir ?? getConfigDir(), "config.json");
}

export function loadConfig(configDir?: string): WienerConfig {
  const fp = configFilePath(configDir);
  if (!existsSync(fp)) {
    return DEFAULT_CONFIG;
  }
  try {
    const raw = JSON.parse(readFileSync(fp, "utf-8")) as Partial<WienerConfig>;
    return mergeConfig(DEFAULT_CONFIG, raw);
  } catch {
    return DEFAULT_CONFIG;
  }
}

function mergeConfig(defaults: WienerConfig, overrides: Partial<WienerConfig>): WienerConfig {
  return {
    ...defaults,
    ...overrides,
    course_resolver: { ...defaults.course_resolver, ...overrides.course_resolver },
    intranet: { ...defaults.intranet, ...overrides.intranet },
    canvas: { ...defaults.canvas, ...overrides.canvas },
    watch: { ...defaults.watch, ...overrides.watch },
    panorama: { ...defaults.panorama, ...overrides.panorama },
  };
}

export function saveConfig(config: WienerConfig, configDir?: string): void {
  const dir = configDir ?? getConfigDir();
  mkdirSync(dir, { recursive: true });
  writeFileSync(configFilePath(dir), JSON.stringify(config, null, 2), "utf-8");
}

export function ensureConfig(configDir?: string): WienerConfig {
  const fp = configFilePath(configDir);
  if (!existsSync(fp)) {
    saveConfig(DEFAULT_CONFIG, configDir);
  }
  return loadConfig(configDir);
}
