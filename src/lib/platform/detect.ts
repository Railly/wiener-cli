// cligentic block: detect (adapted for wiener-cli)
// Environment detection helpers.

import { existsSync, readFileSync } from "node:fs";
import { platform } from "node:os";

let wslCache: boolean | null = null;
export function isWsl(): boolean {
  if (wslCache !== null) return wslCache;
  if (platform() !== "linux") {
    wslCache = false;
    return false;
  }
  try {
    const version = readFileSync("/proc/version", "utf8").toLowerCase();
    wslCache = version.includes("microsoft") || version.includes("wsl");
  } catch {
    wslCache = false;
  }
  return wslCache;
}

export function isCi(): boolean {
  return Boolean(
    process.env.CI ||
      process.env.CONTINUOUS_INTEGRATION ||
      process.env.GITHUB_ACTIONS ||
      process.env.GITLAB_CI ||
      process.env.CIRCLECI ||
      process.env.BUILDKITE,
  );
}

export function isHeadlessLinux(): boolean {
  if (platform() !== "linux") return false;
  if (isWsl()) return false;
  return !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY;
}

export function hasCommand(cmd: string): boolean {
  const separator = platform() === "win32" ? ";" : ":";
  const paths = (process.env.PATH || "").split(separator);
  const exts = platform() === "win32" ? [".exe", ".cmd", ".bat", ""] : [""];
  for (const p of paths) {
    for (const ext of exts) {
      if (existsSync(`${p}/${cmd}${ext}`)) return true;
    }
  }
  return false;
}
