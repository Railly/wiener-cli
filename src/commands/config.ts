import path from "node:path";
import type { Command } from "commander";
import pc from "picocolors";
import { emitNextSteps } from "../lib/agent/next-steps.js";
import { ensureConfig } from "../lib/config.js";
import { getConfigDir } from "../lib/env.js";
import { getWienerPaths } from "../lib/foundation/xdg-paths.js";
import { ok } from "../lib/output/envelope.js";
import { emitJson } from "../lib/output/json.js";

interface ConfigOptions {
  json?: boolean;
  config?: string;
}

function labelRow(label: string, value: string, labelWidth = 16): void {
  console.log(`  ${pc.dim(label.padEnd(labelWidth))}  ${value}`);
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
      const configDir = opts.config ?? getConfigDir();
      const paths = getWienerPaths();
      const today = new Date().toISOString().slice(0, 10);
      const auditFile = path.join(paths.audit, `${today}.jsonl`);

      const data = {
        ...config,
        config_path: path.join(configDir, "config.json"),
      };

      if (opts.json) {
        emitJson(ok(data));
        process.exit(0);
      }

      const profile = config.default_profile ?? "default";

      console.log(`\n${pc.bold(`Configuración — perfil "${profile}"`)}`);
      console.log(pc.dim("─".repeat(42)));
      console.log();

      console.log(pc.bold("Paths"));
      labelRow("config dir:", configDir);
      labelRow("audit log:", auditFile);
      labelRow("state:", path.join(paths.state, "state.json"));
      labelRow("aliases:", path.join(configDir, "aliases.json"));
      labelRow("cache:", `${paths.cache} (${config.canvas.cache_ttl_ms / 1000 / 60}min TTL)`);
      console.log();

      console.log(pc.bold("Comportamiento"));
      labelRow("log_t0_commands:", String(config.log_t0_commands));
      labelRow("log_level:", config.log_level);
      console.log();

      console.log(pc.bold("Course resolver"));
      labelRow("fuzzy threshold:", String(config.course_resolver.fuzzy_confirm_threshold));
      labelRow("no-match top N:", String(config.course_resolver.no_match_top_n));
      console.log();

      console.log(pc.bold("Watch"));
      labelRow("intervalo:", `${config.watch.interval_ms / 60000} min`);
      labelRow("notif backend:", config.watch.notify);
      console.log();

      emitNextSteps([
        { command: "wiener config path", description: "solo el path del config dir" },
        { command: "wiener doctor", description: "verificar salud completa" },
      ]);

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
