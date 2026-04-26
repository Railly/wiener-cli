import { Command } from "commander";
import { fetchHistorial } from "../lib/api/intranet/historial.ts";
import { loadIntranetSession } from "../lib/auth/store.ts";
import { isWienerError } from "../lib/errors.ts";
import { err, ok } from "../lib/output/envelope.ts";
import { emit, emitError } from "../lib/output/json.ts";

export function makeHistorialCommand(): Command {
  return new Command("historial")
    .description("Historial académico completo (intranet)")
    .option("--json", "Output as JSON envelope")
    .option("--profile <profile>", "Profile name", "default")
    .action(async (options) => {
      try {
        const session = await loadIntranetSession(options.profile as string);
        const data = await fetchHistorial(session);

        if (options.json) {
          emit(ok(data));
          return;
        }

        console.log("\nHistorial Académico\n");

        if (data.ciclos.length === 0) {
          console.log("No se encontraron registros en el historial.");
          return;
        }

        for (const ciclo of data.ciclos) {
          console.log(`  Periodo: ${ciclo.periodo}`);
          for (const curso of ciclo.cursos) {
            const nota = curso.nota_final !== null ? String(curso.nota_final).padStart(4) : "  --";
            console.log(
              `    ${curso.codigo.padEnd(12)} ${curso.nombre.slice(0, 45).padEnd(45)} ${String(curso.creditos).padStart(3)} créd  Nota: ${nota}  ${curso.estado}`,
            );
          }
          console.log();
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
