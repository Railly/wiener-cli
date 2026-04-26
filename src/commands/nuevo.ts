import { runNuevo } from "../lib/workflows/nuevo-diff.js";
import { renderNuevo } from "../lib/output/nuevo-renderer.js";
import { emit } from "../lib/output/json.js";
import { ok, err } from "../lib/output/envelope.js";
import { openUrl } from "../lib/browser-open.js";
import { isColorEnabled } from "../lib/tty.js";
import type { Command } from "commander";

export function registerNuevo(program: Command): void {
  program
    .command("nuevo")
    .description("Diff desde última corrida: anuncios, archivos, calificaciones, tareas, módulos")
    .option("--json", "output JSON envelope")
    .option("--dry-run", "diff sin actualizar snapshot")
    .option("--abrir", "abrir cada item en browser")
    .option("--profile <name>", "profile name", "default")
    .action(
      async (opts: { json?: boolean; dryRun?: boolean; abrir?: boolean; profile?: string }) => {
        const t0 = Date.now();
        try {
          const { desde, items } = await runNuevo({
            dryRun: opts.dryRun ?? false,
            profile: opts.profile ?? "default",
          });

          if (opts.abrir) {
            for (const item of items) {
              if (item.url) await openUrl(item.url);
            }
          }

          if (opts.json) {
            emit(ok({ desde, items }, { duration_ms: Date.now() - t0 }));
            return;
          }

          const color = isColorEnabled();
          process.stdout.write(renderNuevo(items, { color, desde }) + "\n");
        } catch (e) {
          if (opts.json) {
            emit(err("error", String(e)));
          } else {
            process.stderr.write(`Error: ${e}\n`);
          }
          process.exit(1);
        }
      }
    );
}
