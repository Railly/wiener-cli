import path from "node:path";
import type { Command } from "commander";
import { ensureConfig } from "../lib/config.js";
import { getConfigDir } from "../lib/env.js";
import { ok } from "../lib/output/envelope.js";
import { printKeyValue } from "../lib/output/human.js";
import { emitJson } from "../lib/output/json.js";

interface ConfigOptions {
  json?: boolean;
  config?: string;
}

export function registerConfig(program: Command): void {
  const configCmd = program.command("config").description("View and manage CLI configuration");

  configCmd
    .command("show")
    .description("Show current configuration")
    .option("--json", "Output JSON envelope")
    .option("--config <path>", "Override config dir")
    .action((opts: ConfigOptions) => {
      const config = ensureConfig(opts.config);
      const data = {
        ...config,
        config_path: path.join(opts.config ?? getConfigDir(), "config.json"),
      };

      if (opts.json) emitJson(ok(data));
      printKeyValue(data as unknown as Record<string, unknown>);
      process.exit(0);
    });

  configCmd
    .command("path")
    .description("Print config directory path")
    .option("--config <path>", "Override config dir")
    .action((opts: { config?: string }) => {
      const dir = opts.config ?? getConfigDir();
      console.log(dir);
      process.exit(0);
    });
}
