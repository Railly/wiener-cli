// cligentic block: xdg-paths (adapted for wiener-cli)
// XDG Base Directory Spec resolver with macOS and Windows fallbacks.

import { mkdirSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";

export type AppPaths = {
  config: string;
  state: string;
  cache: string;
  home: string;
  audit: string;
  sessions: string;
  tmp: string;
};

export function getAppPaths(appName: string): AppPaths {
  const envKey = `${appName.toUpperCase().replace(/-/g, "_")}_HOME`;
  const override = process.env[envKey];

  if (override) {
    return buildPaths(override);
  }

  const os = platform();
  const home = homedir();

  if (os === "darwin") {
    const appSupport = join(home, "Library", "Application Support", appName);
    return {
      config: appSupport,
      state: appSupport,
      cache: join(home, "Library", "Caches", appName),
      home: appSupport,
      audit: join(appSupport, "audit"),
      sessions: join(appSupport, "sessions"),
      tmp: join(appSupport, "tmp"),
    };
  }

  if (os === "win32") {
    const appData = process.env.APPDATA || join(home, "AppData", "Roaming");
    const localAppData = process.env.LOCALAPPDATA || join(home, "AppData", "Local");
    const configDir = join(appData, appName);
    return {
      config: configDir,
      state: join(localAppData, appName),
      cache: join(localAppData, appName, "cache"),
      home: configDir,
      audit: join(configDir, "audit"),
      sessions: join(configDir, "sessions"),
      tmp: join(localAppData, appName, "tmp"),
    };
  }

  const xdgConfig = process.env.XDG_CONFIG_HOME || join(home, ".config");
  const xdgState = process.env.XDG_STATE_HOME || join(home, ".local", "state");
  const xdgCache = process.env.XDG_CACHE_HOME || join(home, ".cache");
  const configDir = join(xdgConfig, appName);

  return {
    config: configDir,
    state: join(xdgState, appName),
    cache: join(xdgCache, appName),
    home: configDir,
    audit: join(xdgState, appName, "audit"),
    sessions: join(configDir, "sessions"),
    tmp: join(xdgCache, appName, "tmp"),
  };
}

export function ensureHome(paths: AppPaths): void {
  for (const dir of [paths.config, paths.state, paths.cache, paths.audit, paths.tmp]) {
    mkdirSync(dir, { recursive: true, mode: 0o755 });
  }
  mkdirSync(paths.sessions, { recursive: true, mode: 0o700 });
}

function buildPaths(root: string): AppPaths {
  return {
    config: root,
    state: root,
    cache: join(root, "cache"),
    home: root,
    audit: join(root, "audit"),
    sessions: join(root, "sessions"),
    tmp: join(root, "tmp"),
  };
}

// wiener-cli adapter: returns the canonical config dir respecting
// WIENER_CONFIG_DIR env var (test override) and XDG on Linux.
export function getWienerPaths(): AppPaths {
  const configDirOverride = process.env.WIENER_CONFIG_DIR;
  if (configDirOverride) {
    return buildPaths(configDirOverride);
  }
  return getAppPaths("wiener");
}
