/**
 * T2 confirmation for `wiener watch --detach`.
 *
 * PHASE D INTEGRATION POINT:
 *   Phase D implements the full `wiener watch` command in `src/commands/watch.ts`.
 *   When adding `--detach` support, call `confirmWatchDetach(opts)` BEFORE
 *   spawning the background daemon. This file exports the confirmation flow
 *   only; the daemonization logic lives entirely in Phase D.
 *
 *   Expected call-site in Phase D:
 *     ```ts
 *     if (opts.detach) {
 *       const decision = await confirmWatchDetach(opts);
 *       if (decision !== 'proceed') return;
 *       // ... spawn daemon, write ~/.wiener/watch.pid
 *     }
 *     ```
 */

import pc from "picocolors";
import { confirmT2 } from "../lib/safety/confirm.ts";
import type { ConfirmResult } from "../lib/safety/confirm.ts";

export interface WatchDetachOptions {
  yes: boolean;
  dryRun: boolean;
  noInput: boolean;
}

export async function confirmWatchDetach(opts: WatchDetachOptions): Promise<ConfirmResult> {
  const previewText = [
    pc.bold("wiener watch --detach — PREVIEW"),
    "─".repeat(40),
    "wiener watch will run in background, polling every 30 min.",
    "New grades, announcements, and files trigger macOS notifications.",
    "",
    `Stop with: ${pc.cyan("wiener watch stop")}`,
    `Log at:    ${pc.dim("~/.wiener/watch.log")}`,
    `PID at:    ${pc.dim("~/.wiener/watch.pid")}`,
    "",
    pc.dim("Only one watch instance per user is allowed (lockfile)."),
    pc.dim("Continúa con --yes o cancela con Ctrl+C."),
  ].join("\n");

  return confirmT2("watch detach", previewText, opts);
}
