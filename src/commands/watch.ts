import type { Command } from "commander";
import { startWatch, stopWatch } from "../lib/workflows/watch-loop.js";

export function registerWatch(program: Command): void {
  const watchCmd = program
    .command("watch")
    .description("Loop en background: diff cada N min, notif macOS si hay cambios")
    .option("--detach", "daemonize (write pid, log to ~/.wiener/watch.log)")
    .option("--interval <ms>", "intervalo en ms", (v) => Number(v))
    .option("--whatsapp", "notif via WhatsApp en vez de macOS")
    .option("--dry-run", "ejecutar una vez y salir sin guardar estado")
    .option("--profile <name>", "profile name", "default")
    .action(
      async (opts: {
        detach?: boolean;
        interval?: number;
        whatsapp?: boolean;
        dryRun?: boolean;
        profile?: string;
      }) => {
        try {
          await startWatch({
            interval: opts.interval,
            notify: opts.whatsapp ? "whatsapp" : "macos",
            detach: opts.detach,
            dryRun: opts.dryRun,
            profile: opts.profile ?? "default",
            whatsapp: opts.whatsapp,
          });
        } catch (e) {
          process.stderr.write(`Error: ${e}\n`);
          process.exit(1);
        }
      },
    );

  watchCmd
    .command("stop")
    .description("Terminar proceso watch en background")
    .action(() => {
      try {
        stopWatch();
        process.stdout.write("Watch detenido.\n");
      } catch (e) {
        process.stderr.write(`Error: ${e}\n`);
        process.exit(1);
      }
    });

  watchCmd
    .command("snooze <duration>")
    .description("Silenciar notificaciones por duración (ej: 2h, 30m)")
    .action(async (duration: string) => {
      const { loadConfig, saveConfig } = await import("../lib/env.js");
      const now = new Date();
      const match = duration.match(/^(\d+)(h|m)$/);
      if (!match) {
        process.stderr.write("Formato inválido. Usa: 2h o 30m\n");
        process.exit(1);
      }
      const [, n, unit] = match;
      const ms = unit === "h" ? Number(n) * 3600000 : Number(n) * 60000;
      const until = new Date(now.getTime() + ms);
      const config = loadConfig();
      config.watch.snooze_until = until.toISOString();
      saveConfig(config);
      process.stdout.write(`Snoozed hasta ${until.toLocaleString("es-PE")}\n`);
    });
}
