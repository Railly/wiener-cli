// wiener log — recent T2 audit actions

import type { Command } from "commander";
import pc from "picocolors";
import { tailAudit } from "../lib/foundation/audit-log.js";
import { getWienerPaths } from "../lib/foundation/xdg-paths.js";
import { ok } from "../lib/output/envelope.js";
import { emitJson } from "../lib/output/json.js";
import { relativeDate } from "../lib/time.js";

interface LogOptions {
  json?: boolean;
  since?: string;
  n?: string;
}

function parseSinceDays(since: string | undefined): number {
  if (!since) return 1;
  const m = /^(\d+)d$/.exec(since);
  if (m?.[1]) return Number.parseInt(m[1], 10);
  const h = /^(\d+)h$/.exec(since);
  if (h?.[1]) return Number.parseInt(h[1], 10) / 24;
  return 1;
}

function statusIcon(result: string): string {
  if (result === "ok") return pc.green("✓");
  if (result === "error") return pc.red("✗");
  if (result === "dry-run") return pc.yellow("~");
  return pc.dim("·");
}

export function registerLog(program: Command): void {
  program
    .command("log")
    .description("Acciones recientes del audit log")
    .option("--json", "Output JSON envelope")
    .option("--since <period>", "Período a mostrar, ej. 7d o 24h (default: 1d)", "1d")
    .option("-n <n>", "Máximo de entradas a mostrar", "30")
    .action((opts: LogOptions) => {
      const paths = getWienerPaths();
      const limit = Number.parseInt(opts.n ?? "30", 10);
      const sinceMs = parseSinceDays(opts.since) * 24 * 60 * 60 * 1000;
      const cutoff = Date.now() - sinceMs;

      const all = tailAudit(paths.audit, limit * 3);
      const records = all.filter((r) => new Date(r.ts).getTime() >= cutoff).slice(0, limit);

      if (opts.json) {
        emitJson(ok({ records }));
        return;
      }

      console.log(`\n${pc.bold("Acciones recientes")}`);
      console.log(pc.dim("─".repeat(56)));
      console.log();

      if (records.length === 0) {
        console.log(pc.dim(`  Sin acciones en los últimos ${opts.since ?? "1d"}.`));
        console.log();
        return;
      }

      for (const r of records) {
        const when = pc.dim(relativeDate(r.ts).padEnd(10));
        const icon = statusIcon(r.result);
        const cmd = pc.cyan(r.command.padEnd(32));
        const metaStr =
          r.meta && typeof r.meta === "object"
            ? Object.entries(r.meta)
                .filter(([k]) => !["ts", "command", "result", "kind"].includes(k))
                .slice(0, 2)
                .map(([, v]) => String(v).slice(0, 20))
                .join(" · ")
            : "";
        const meta = metaStr ? pc.dim(metaStr) : "";
        console.log(`  ${when}  ${icon}  ${cmd}  ${meta}`);
      }

      console.log();
      console.log(pc.dim(`→ wiener log --json             raw audit jsonl`));
      console.log(pc.dim(`→ wiener log --since 7d         últimos 7 días`));
      console.log();
    });
}
