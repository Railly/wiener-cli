import type { Command } from "commander";
import { resetAlias } from "../../../lib/courses/alias-store.js";
import { ok } from "../../../lib/output/envelope.js";
import { printSuccess } from "../../../lib/output/human.js";
import { emitJson } from "../../../lib/output/json.js";

interface ResetOptions {
  json?: boolean;
  profile?: string;
}

export function registerAliasReset(aliasesCmd: Command): void {
  aliasesCmd
    .command("reset <code>")
    .description("Reset a course alias to auto-generated default")
    .option("--json", "Output JSON envelope")
    .option("--profile <name>", "Profile to use", "default")
    .action(async (code: string, opts: ResetOptions) => {
      const profile = opts.profile ?? "default";
      resetAlias(code, profile);

      const data = { ok: true };
      if (opts.json) emitJson(ok(data));
      printSuccess(`Alias for ${code} reset to auto-generated default`);
      process.exit(0);
    });
}
