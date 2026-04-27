import Table from "cli-table3";
import { Command } from "commander";
import pc from "picocolors";
import { NEXT_STEPS, emitNextSteps } from "../../lib/agent/next-steps.ts";
import { fetchNotas } from "../../lib/api/intranet/notas.ts";
import { loadIntranetSession } from "../../lib/auth/store.ts";
import { isWienerError } from "../../lib/errors.ts";
import { err, ok } from "../../lib/output/envelope.ts";
import { emit, emitError } from "../../lib/output/json.ts";
import { isColorEnabled } from "../../lib/tty.ts";

function colorNota(nota: number | null, color: boolean): string {
  if (nota === null) return color ? pc.dim("  —") : "  —";
  const s = String(nota).padStart(4);
  if (!color) return s;
  if (nota >= 14) return pc.green(s);
  if (nota >= 11) return pc.yellow(s);
  return pc.red(s);
}

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
        const color = isColorEnabled();

        const envelope = ok({ ...data, periodos_disponibles: periodos });

        if (options.json) {
          emit(envelope);
          return;
        }

        // Header section
        console.log("");
        const header = `Notas — Periodo: ${data.periodo}`;
        console.log(color ? pc.bold(pc.cyan(header)) : header);
        console.log(
          color
            ? pc.dim("─".repeat(Math.max(header.length, 40)))
            : "─".repeat(Math.max(header.length, 40)),
        );

        // Alumno info
        const alumnoInfo = [
          data.alumno.codigo &&
            (color
              ? `${pc.dim("Código:")} ${data.alumno.codigo}`
              : `Código: ${data.alumno.codigo}`),
          data.alumno.carrera &&
            (color
              ? `${pc.dim("Carrera:")} ${data.alumno.carrera}`
              : `Carrera: ${data.alumno.carrera}`),
          data.alumno.ciclo &&
            (color ? `${pc.dim("Ciclo:")} ${data.alumno.ciclo}` : `Ciclo: ${data.alumno.ciclo}`),
        ].filter(Boolean);
        if (alumnoInfo.length > 0) {
          console.log(`  ${alumnoInfo.join("  ·  ")}`);
        }

        const stats = [
          data.ponderado_acumulado !== null &&
            (color
              ? `${pc.dim("Ponderado acumulado:")} ${pc.bold(String(data.ponderado_acumulado))}`
              : `Ponderado acumulado: ${data.ponderado_acumulado}`),
          data.ponderado_historico !== null &&
            (color
              ? `${pc.dim("Histórico:")} ${pc.bold(String(data.ponderado_historico))}`
              : `Histórico: ${data.ponderado_historico}`),
          data.orden_merito !== null &&
            (color
              ? `${pc.dim("Mérito:")} ${pc.bold(`#${data.orden_merito}`)}`
              : `Mérito: #${data.orden_merito}`),
        ].filter(Boolean);
        if (stats.length > 0) {
          console.log(`  ${stats.join("  ·  ")}`);
        }

        console.log("");

        if (data.cursos.length === 0) {
          console.log(
            color ? pc.dim("  No hay notas disponibles.") : "  No hay notas disponibles.",
          );
          console.log(
            color
              ? pc.dim("  Usa --periodo <periodo> para cambiar el periodo.")
              : "  Usa --periodo <periodo> para cambiar el periodo.",
          );
          emitNextSteps(
            NEXT_STEPS.afterNotas as readonly { command: string; description: string }[],
          );
          return;
        }

        // Table
        const table = new Table({
          head: [
            color ? pc.bold(pc.cyan("Código")) : "Código",
            color ? pc.bold(pc.cyan("Nombre")) : "Nombre",
            color ? pc.bold(pc.cyan("Créd")) : "Créd",
            color ? pc.bold(pc.cyan("Nota")) : "Nota",
            color ? pc.bold(pc.cyan("Estado")) : "Estado",
          ],
          style: { head: [], border: color ? ["dim"] : [] },
          chars: {
            top: "─",
            "top-mid": "┬",
            "top-left": "╭",
            "top-right": "╮",
            bottom: "─",
            "bottom-mid": "┴",
            "bottom-left": "╰",
            "bottom-right": "╯",
            left: "│",
            "left-mid": "├",
            mid: "─",
            "mid-mid": "┼",
            right: "│",
            "right-mid": "┤",
            middle: "│",
          },
        });

        for (const c of data.cursos) {
          const estadoColored = (() => {
            if (!color) return c.estado;
            if (c.estado === "APROBADO") return pc.green(c.estado);
            if (c.estado === "DESAPROBADO") return pc.red(c.estado);
            return pc.dim(c.estado);
          })();
          table.push([
            color ? pc.bold(pc.yellow(c.codigo)) : c.codigo,
            c.nombre.slice(0, 40),
            String(c.creditos),
            colorNota(c.nota_final, color),
            estadoColored,
          ]);
        }

        console.log(table.toString());
        emitNextSteps(NEXT_STEPS.afterNotas as readonly { command: string; description: string }[]);
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
        const color = isColorEnabled();

        if (options.json) {
          emit(ok({ periodos }));
          return;
        }

        if (periodos.length === 0) {
          console.log("No se encontraron periodos.");
          return;
        }

        console.log(
          color ? `\n${pc.bold(pc.cyan("Periodos disponibles"))}` : "\nPeriodos disponibles",
        );
        for (const p of periodos) {
          console.log(color ? `  ${pc.yellow(p)}` : `  ${p}`);
        }
        console.log("");
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
