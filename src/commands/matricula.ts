import { Command } from "commander";
import { loadIntranetSession } from "../lib/auth/store.ts";
import { fetchMatricula } from "../lib/api/intranet/matricula.ts";
import { ok, err } from "../lib/output/envelope.ts";
import { emit, emitError } from "../lib/output/json.ts";
import { isWienerError } from "../lib/errors.ts";

export function makeMatriculaCommand(): Command {
  return new Command("matricula")
    .description("Ficha de matrícula del periodo actual (intranet)")
    .option("--json", "Output as JSON envelope")
    .option("--profile <profile>", "Profile name", "default")
    .action(async (options) => {
      try {
        const session = await loadIntranetSession(options.profile as string);
        const data = await fetchMatricula(session);

        if (options.json) {
          emit(ok(data));
          return;
        }

        console.log(`\nFicha de Matrícula`);
        console.log(`Periodo: ${data.periodo || "—"}  |  Ciclo: ${data.ciclo || "—"}\n`);

        if (data.cursos.length === 0) {
          console.log("No se encontraron cursos matriculados.");
          return;
        }

        console.log("  Código       Nombre                                    Créd  Sección   Modalidad");
        console.log("  " + "─".repeat(90));
        for (const c of data.cursos) {
          console.log(
            `  ${c.codigo.padEnd(12)} ${c.nombre.slice(0, 40).padEnd(40)} ${String(c.creditos).padStart(4)}  ${c.seccion.padEnd(8)}  ${c.modalidad}`,
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
