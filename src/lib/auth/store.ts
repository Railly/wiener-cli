// PHASE A WILL REPLACE: Auth store stub — Phase A provides keychain-backed implementation

import { WienerError } from "../errors.js";

export function loadCanvasToken(profile = "default"): string {
  const envToken = process.env["WIENER_CANVAS_TOKEN"];
  if (envToken) return envToken;

  // TODO: Phase A reads from macOS Keychain via `security` cmd
  // or from ~/.wiener/<profile>/canvas-session.json (Linux fallback)
  throw new WienerError(
    "canvas-not-configured",
    `No Canvas PAT configured for profile "${profile}". Run: wiener auth canvas set-token <pat>`,
    "Generate a PAT at: https://campus.uwiener.edu.pe/profile/settings"
  );
}
