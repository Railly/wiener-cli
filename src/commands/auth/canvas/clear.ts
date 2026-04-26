import type { Command } from "commander";
import { wipeCanvasSession } from "../../../lib/auth/store.js";
import { ok } from "../../../lib/output/envelope.js";
import { printSuccess } from "../../../lib/output/human.js";
import { emitJson } from "../../../lib/output/json.js";

interface ClearOptions {
  json?: boolean;
  profile?: string;
}

export function registerCanvasClear(canvasCmd: Command): void {
  canvasCmd
    .command("clear")
    .description("Remove stored Canvas PAT")
    .option("--json", "Output JSON envelope")
    .option("--profile <name>", "Profile to use", "default")
    .action(async (opts: ClearOptions) => {
      const profile = opts.profile ?? "default";
      await wipeCanvasSession(profile);

      const data = { ok: true };
      if (opts.json) {
        emitJson(ok(data));
      }
      printSuccess("Canvas PAT eliminado");
      process.exit(0);
    });
}
