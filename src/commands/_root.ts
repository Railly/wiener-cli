import type { Command } from "commander";
import { renderBanner } from "../lib/output/banner.js";
import { ok } from "../lib/output/envelope.js";
import { emit } from "../lib/output/json.js";
import { renderPanorama } from "../lib/output/panorama-renderer.js";
import { isColorEnabled } from "../lib/tty.js";
import { buildPanorama } from "../lib/workflows/panorama.js";

export function registerRoot(program: Command): void {
  program
    .option("--no-update-state", "skip updating state snapshot")
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

      // Show banner when not authenticated
      if (!panorama.authed) {
        process.stdout.write(renderBanner({ color }));
      }

      process.stdout.write(renderPanorama(panorama, { color }));
    });
}
