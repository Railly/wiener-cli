import { getWienerPaths } from "./foundation/xdg-paths.js";

export interface WienerEnv {
  WIENER_INTRANET_USER?: string;
  WIENER_INTRANET_PASS?: string;
  WIENER_INTRANET_PERFIL?: "A" | "D" | "P";
  WIENER_CANVAS_TOKEN?: string;
  WIENER_PROFILE?: string;
  WIENER_CONFIG_DIR?: string;
  WIENER_LIVE_TEST?: string;
}

export function getEnv(): WienerEnv {
  const perfil = process.env.WIENER_INTRANET_PERFIL;
  return {
    WIENER_INTRANET_USER: process.env.WIENER_INTRANET_USER,
    WIENER_INTRANET_PASS: process.env.WIENER_INTRANET_PASS,
    WIENER_INTRANET_PERFIL: perfil === "A" || perfil === "D" || perfil === "P" ? perfil : undefined,
    WIENER_CANVAS_TOKEN: process.env.WIENER_CANVAS_TOKEN,
    WIENER_PROFILE: process.env.WIENER_PROFILE,
    WIENER_CONFIG_DIR: process.env.WIENER_CONFIG_DIR,
    WIENER_LIVE_TEST: process.env.WIENER_LIVE_TEST,
  };
}

export function getConfigDir(): string {
  return getWienerPaths().home;
}

export function getProfileDir(profile = "default"): string {
  return `${getConfigDir()}/${profile}`;
}

export { loadConfig, saveConfig } from "./config.js";
