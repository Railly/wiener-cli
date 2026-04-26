import type { Command } from "commander";
import { getProfileAliases } from "../../../lib/courses/alias-store.js";
import { ok } from "../../../lib/output/envelope.js";
import { printTable } from "../../../lib/output/human.js";
import { emitJson } from "../../../lib/output/json.js";

interface AliasListOptions {
  json?: boolean;
  profile?: string;
}

export function registerAliasList(aliasesCmd: Command): void {
  aliasesCmd
    .command("list")
    .description("Show all configured course aliases")
    .option("--json", "Output JSON envelope")
    .option("--profile <name>", "Profile to use", "default")
    .action(async (opts: AliasListOptions) => {
      const profile = opts.profile ?? "default";
      const aliases = getProfileAliases(profile);
      const rows = Object.entries(aliases).map(([code, alias]) => ({ code, alias }));

      const data = { aliases: rows };
      if (opts.json) emitJson(ok(data));
      if (rows.length === 0) {
        console.log("No custom aliases configured. Run `wiener cursos aliases` to set some.");
      } else {
        printTable(rows, [
          { header: "Code", key: "code" },
          { header: "Alias", key: "alias" },
        ]);
      }
      process.exit(0);
    });
}
