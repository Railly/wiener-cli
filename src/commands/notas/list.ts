import { Command } from "commander";
import { loadIntranetSession } from "../../lib/auth/store.ts";
import { fetchNotas } from "../../lib/api/intranet/notas.ts";
import { ok, err } from "../../lib/output/envelope.ts";
import { emit, emitError } from "../../lib/output/json.ts";
import { isWienerError } from "../../lib/errors.ts";

export function makeNotasCommand(): Command {
  const cmd = new Command("notas")
    .description("Notas oficiales del periodo actual (intranet)")
    .option("--periodo <periodo>", "Periodo académico (ej: 2026-I, 2025-II)")
    .option("--json", "Output as JSON envelope")
    .option("--profile <profile>", "Profile name", "default")
    .action(async (options) => {
      try {
        const session = await loadIntranetSession(options.profile as string);
        const { data, periodos } = await fetchNotas(session, options.periodo as string | undefined);

        const envelope = ok({ ...data, periodos_disponibles: periodos });

        if (options.json) {
          emit(envelope);
          return;
        }

        // Human output
        console.log(`\nNotas — Periodo: ${data.periodo}`);
        console.log(`Alumno: ${data.alumno.codigo} | ${data.alumno.carrera} | Ciclo ${data.alumno.ciclo}`);
        if (data.ponderado_acumulado !== null) {
          console.log(`Ponderado acumulado: ${data.ponderado_acumulado}`);
        }
        if (data.ponderado_historico !== null) {
          console.log(`Ponderado histórico: ${data.ponderado_historico}`);
        }
        if (data.orden_merito !== null) {
          console.log(`Orden de mérito: ${data.orden_merito}`);
        }
        console.log();

        if (data.cursos.length === 0) {
          console.log(
            "No hay notas disponibles. Use --periodo <periodo> o `wiener notas periodos` para ver opciones.",
          );
          return;
        }

        console.log("  Código       Nombre                                    Créd  Nota   Estado");
        console.log("  " + "─".repeat(80));
        for (const c of data.cursos) {
          const nota = c.nota_final !== null ? String(c.nota_final).padStart(4) : "  --";
          console.log(
            `  ${c.codigo.padEnd(12)} ${c.nombre.slice(0, 40).padEnd(40)} ${String(c.creditos).padStart(4)}  ${nota}   ${c.estado}`,
          );
        }
      } catch (e) {
        if (isWienerError(e)) {
          emitError(err(e.code, e.message, e.hint));
          process.exit(1);
        }
        emitError(err("parse-error", String(e), "Run `wiener doctor`"));
        process.exit(1);
      }
    });

  cmd
    .command("periodos")
    .description("Lista los periodos disponibles en el selector de notas")
    .option("--json", "Output as JSON envelope")
    .option("--profile <profile>", "Profile name", "default")
    .action(async (options) => {
      try {
        const session = await loadIntranetSession(options.profile as string);
        const { periodos } = await fetchNotas(session);

        if (options.json) {
          emit(ok({ periodos }));
          return;
        }

        if (periodos.length === 0) {
          console.log("No se encontraron periodos.");
          return;
        }

        console.log("\nPeriodos disponibles:");
        for (const p of periodos) {
          console.log(`  ${p}`);
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

  return cmd;
}
