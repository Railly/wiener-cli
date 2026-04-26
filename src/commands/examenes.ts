import { Command } from "commander";
import { fetchExamenes } from "../lib/api/intranet/examenes.ts";
import { loadIntranetSession } from "../lib/auth/store.ts";
import { isWienerError } from "../lib/errors.ts";
import { err, ok } from "../lib/output/envelope.ts";
import { emit, emitError } from "../lib/output/json.ts";

export function makeExamenesCommand(): Command {
  return new Command("examenes")
    .description("Rol de exámenes próximos (intranet)")
    .option("--json", "Output as JSON envelope")
    .option("--profile <profile>", "Profile name", "default")
    .action(async (options) => {
      try {
        const session = await loadIntranetSession(options.profile as string);
        const data = await fetchExamenes(session);

        if (options.json) {
          emit(ok(data));
          return;
        }

        if (data.examenes.length === 0) {
          console.log("\nNo hay exámenes programados.");
          return;
        }

        console.log("\nRol de Exámenes\n");
        console.log(
          "  Fecha        Hora     Curso                                      Modalidad    Aula",
        );
        console.log(`  ${"─".repeat(90)}`);
        for (const e of data.examenes) {
          console.log(
            `  ${e.fecha.padEnd(12)} ${e.hora.padEnd(8)} ${e.curso.slice(0, 40).padEnd(40)} ${e.modalidad.padEnd(12)} ${e.aula}`,
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
