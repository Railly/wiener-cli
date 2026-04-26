import { Command } from "commander";
import { loadIntranetSession } from "../lib/auth/store.ts";
import { fetchAsistencia } from "../lib/api/intranet/asistencia.ts";
import { ok, err } from "../lib/output/envelope.ts";
import { emit, emitError } from "../lib/output/json.ts";
import { isWienerError } from "../lib/errors.ts";

export function makeAsistenciaCommand(): Command {
  return new Command("asistencia")
    .description("Asistencia por curso (intranet)")
    .option("--curso <ref>", "Filtrar por código o nombre de curso")
    .option("--json", "Output as JSON envelope")
    .option("--profile <profile>", "Profile name", "default")
    .action(async (options) => {
      try {
        const session = await loadIntranetSession(options.profile as string);
        let { cursos } = await fetchAsistencia(session);

        if (options.curso) {
          const q = (options.curso as string).toLowerCase();
          cursos = cursos.filter(
            (c) =>
              c.codigo.toLowerCase().includes(q) || c.nombre.toLowerCase().includes(q),
          );
        }

        if (options.json) {
          emit(ok({ cursos }));
          return;
        }

        if (cursos.length === 0) {
          console.log("No se encontraron registros de asistencia.");
          return;
        }

        console.log("\nAsistencia\n");
        console.log("  Código       Nombre                                    Total   Asist   Faltas  Tard.   %");
        console.log("  " + "─".repeat(95));
        for (const c of cursos) {
          console.log(
            `  ${c.codigo.padEnd(12)} ${c.nombre.slice(0, 40).padEnd(40)} ${String(c.total_clases).padStart(5)}   ${String(c.asistencias).padStart(5)}   ${String(c.faltas).padStart(5)}   ${String(c.tardanzas).padStart(4)}   ${c.porcentaje}%`,
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
    });
}
