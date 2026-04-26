import { Command } from "commander";
import { loadIntranetSession } from "../../lib/auth/store.ts";
import { fetchPlan, fetchPlanAvance } from "../../lib/api/intranet/plan.ts";
import { ok, err } from "../../lib/output/envelope.ts";
import { emit, emitError } from "../../lib/output/json.ts";
import { isWienerError } from "../../lib/errors.ts";

export function makePlanCommand(): Command {
  const cmd = new Command("plan")
    .description("Plan de estudios completo (intranet)")
    .option("--json", "Output as JSON envelope")
    .option("--profile <profile>", "Profile name", "default")
    .action(async (options) => {
      try {
        const session = await loadIntranetSession(options.profile as string);
        const data = await fetchPlan(session);

        if (options.json) {
          emit(ok(data));
          return;
        }

        console.log(`\nPlan de Estudios — ${data.carrera || "Carrera"}\n`);
        for (const ciclo of data.ciclos) {
          console.log(`  ${ciclo.ciclo}`);
          for (const curso of ciclo.cursos) {
            console.log(
              `    ${curso.codigo.padEnd(12)} ${curso.nombre.slice(0, 50).padEnd(50)} ${String(curso.creditos).padStart(3)} créd${curso.estado ? `  [${curso.estado}]` : ""}`,
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

  cmd
    .command("avance")
    .description("Avance académico vs plan de estudios")
    .option("--json", "Output as JSON envelope")
    .option("--profile <profile>", "Profile name", "default")
    .action(async (options) => {
      try {
        const session = await loadIntranetSession(options.profile as string);
        const data = await fetchPlanAvance(session);

        if (options.json) {
          emit(ok(data));
          return;
        }

        console.log("\nAvance Académico\n");
        console.log(`  Créditos aprobados: ${data.creditos_aprobados} / ${data.creditos_total}`);
        console.log(`  Cursos aprobados:   ${data.cursos_aprobados}`);
        console.log(`  Cursos pendientes:  ${data.cursos_pendientes}`);
        console.log(`  Porcentaje:         ${data.porcentaje}%`);

        const bar = Math.round(data.porcentaje / 2);
        const empty = 50 - bar;
        console.log(`\n  [${"█".repeat(bar)}${"░".repeat(empty)}] ${data.porcentaje}%`);
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
