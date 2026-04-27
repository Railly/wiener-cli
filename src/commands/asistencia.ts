import Table from "cli-table3";
import { Command } from "commander";
import pc from "picocolors";
import { fetchAsistencia } from "../lib/api/intranet/asistencia.ts";
import { loadIntranetSession } from "../lib/auth/store.ts";
import { isWienerError } from "../lib/errors.ts";
import { err, ok } from "../lib/output/envelope.ts";
import { emit, emitError } from "../lib/output/json.ts";
import { isColorEnabled } from "../lib/tty.ts";

function colorPorcentaje(pct: number, color: boolean): string {
  const s = `${pct}%`;
  if (!color) return s;
  if (pct >= 80) return pc.green(s);
  if (pct >= 70) return pc.yellow(s);
  return pc.bold(pc.red(s));
}

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
        const color = isColorEnabled();

        if (options.curso) {
          const q = (options.curso as string).toLowerCase();
          cursos = cursos.filter(
            (c) => c.codigo.toLowerCase().includes(q) || c.nombre.toLowerCase().includes(q),
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

        console.log("");
        const header = "Asistencia";
        console.log(color ? pc.bold(pc.cyan(header)) : header);

        const table = new Table({
          head: [
            color ? pc.bold(pc.cyan("Código")) : "Código",
            color ? pc.bold(pc.cyan("Nombre")) : "Nombre",
            color ? pc.bold(pc.cyan("Total")) : "Total",
            color ? pc.bold(pc.cyan("Asist.")) : "Asist.",
            color ? pc.bold(pc.cyan("Faltas")) : "Faltas",
            color ? pc.bold(pc.cyan("Tard.")) : "Tard.",
            color ? pc.bold(pc.cyan("%")) : "%",
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

        for (const c of cursos) {
          table.push([
            color ? pc.bold(pc.yellow(c.codigo)) : c.codigo,
            c.nombre.slice(0, 35),
            String(c.total_clases),
            String(c.asistencias),
            c.faltas > 0 ? (color ? pc.red(String(c.faltas)) : String(c.faltas)) : String(c.faltas),
            String(c.tardanzas),
            colorPorcentaje(c.porcentaje, color),
          ]);
        }

        console.log(table.toString());
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
}
