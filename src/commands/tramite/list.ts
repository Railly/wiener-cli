import { Command } from "commander";
import { fetchTramites } from "../../lib/api/intranet/tramite.ts";
import { loadIntranetSession } from "../../lib/auth/store.ts";
import { isWienerError } from "../../lib/errors.ts";
import { err, ok } from "../../lib/output/envelope.ts";
import { emit, emitError } from "../../lib/output/json.ts";

export function makeTramiteCommand(): Command {
  const cmd = new Command("tramite")
    .description("Trámites académicos (intranet — path needs validation)")
    .addCommand(
      new Command("list")
        .description("Lista de trámites en curso")
        .option("--json", "Output as JSON envelope")
        .option("--profile <profile>", "Profile name", "default")
        .action(async (options) => {
          try {
            const session = await loadIntranetSession(options.profile as string);
            const data = await fetchTramites(session);

            if (options.json) {
              emit(ok(data));
              return;
            }

            if (data.tramites.length === 0) {
              console.log("\nNo se encontraron trámites en curso.");
              return;
            }

            console.log("\nTrámites Académicos\n");
            console.log(
              "  N°    Tipo                                       Estado         Fecha Inicio",
            );
            console.log(`  ${"─".repeat(80)}`);
            for (const t of data.tramites) {
              console.log(
                `  ${t.id.padEnd(5)} ${t.tipo.slice(0, 42).padEnd(42)} ${t.estado.padEnd(14)} ${t.fecha_inicio ?? "—"}`,
              );
            }
          } catch (e) {
            if (isWienerError(e)) {
              emitError(err(e.code, e.message, e.hint));
              process.exit(1);
            }
            emitError(err("parse-error", String(e)));
            process.exit(1);
          }
        }),
    );

  return cmd;
}
