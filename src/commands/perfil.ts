import { Command } from "commander";
import { fetchPerfil } from "../lib/api/intranet/perfil.ts";
import { loadIntranetSession } from "../lib/auth/store.ts";
import { isWienerError } from "../lib/errors.ts";
import { err, ok } from "../lib/output/envelope.ts";
import { emit, emitError } from "../lib/output/json.ts";

export function makePerfilCommand(): Command {
  return new Command("perfil")
    .description("Datos del estudiante (intranet)")
    .option("--json", "Output as JSON envelope. Includes all raw fields.")
    .option("--profile <profile>", "Profile name", "default")
    .action(async (options) => {
      try {
        const session = await loadIntranetSession(options.profile as string);
        const data = await fetchPerfil(session);

        if (options.json) {
          emit(ok(data));
          return;
        }

        // Human output: show without sensitive raw data
        console.log("\nPerfil del Estudiante\n");
        const rows: [string, string][] = [
          ["Código", data.codigo],
          ["Nombres", data.nombres],
          ["Apellidos", data.apellidos],
          ["DNI", data.dni ? `${data.dni.slice(0, 4)}****` : "—"],
          ["Carrera", data.carrera],
        ];
        if (data.facultad) rows.push(["Facultad", data.facultad]);
        if (data.ciclo) rows.push(["Ciclo", data.ciclo]);
        if (data.email) rows.push(["Email", data.email]);

        for (const [label, val] of rows) {
          console.log(`  ${label.padEnd(12)} ${val || "—"}`);
        }
      } catch (e) {
        if (isWienerError(e)) {
          emitError(err(e.code, e.message, e.hint));
          process.exit(1);
        }
        emitError(err("parse-error", String(e)));
        process.exit(1);
      }
    });
}
