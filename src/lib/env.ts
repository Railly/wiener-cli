import { homedir } from "os";
import { join } from "path";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { DEFAULT_CONFIG, type WienerConfig } from "../types/config.js";

export function wienerDir(): string {
  return process.env.WIENER_CONFIG_DIR ?? join(homedir(), ".wiener");
}

export function configPath(): string {
  return join(wienerDir(), "config.json");
}

export function loadConfig(): WienerConfig {
  const path = configPath();
  if (!existsSync(path)) return DEFAULT_CONFIG;
  try {
    const raw = JSON.parse(readFileSync(path, "utf-8")) as Partial<WienerConfig>;
    return { ...DEFAULT_CONFIG, ...raw } as WienerConfig;
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveConfig(config: WienerConfig): void {
  const dir = wienerDir();
  mkdirSync(dir, { recursive: true });
  writeFileSync(configPath(), JSON.stringify(config, null, 2));
}
