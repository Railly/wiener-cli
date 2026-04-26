import { buildPanorama } from "../lib/workflows/panorama.js";
import { renderPanorama } from "../lib/output/panorama-renderer.js";
import { emit } from "../lib/output/json.js";
import { ok } from "../lib/output/envelope.js";
import { isColorEnabled } from "../lib/tty.js";
import type { Command } from "commander";

export function registerRoot(program: Command): void {
  program
    .option("--json", "output JSON envelope")
    .option("--no-update-state", "skip updating state snapshot")
    .option("--profile <name>", "profile name", "default")
    .action(async (opts: { json?: boolean; noUpdateState?: boolean; profile?: string }) => {
      const t0 = Date.now();
      const panorama = await buildPanorama({
        noUpdateState: opts.noUpdateState ?? false,
        profile: opts.profile ?? "default",
      });
      const duration_ms = Date.now() - t0;

      if (opts.json) {
        emit(ok(panorama, { duration_ms }));
        return;
      }

      const color = isColorEnabled();
      process.stdout.write(renderPanorama(panorama, { color }));
    });
}
