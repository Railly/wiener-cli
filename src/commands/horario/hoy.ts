import { Command } from "commander";
import pc from "picocolors";
import { NEXT_STEPS, renderNextSteps } from "../../lib/agent/next-steps.ts";
import { fetchHorario } from "../../lib/api/intranet/horario.ts";
import { loadIntranetSession } from "../../lib/auth/store.ts";
import { isWienerError } from "../../lib/errors.ts";
import { filterBloquesByDayCode, getLimaDateISO, getLimaDayCode } from "../../lib/horario-time.ts";
import { err, ok } from "../../lib/output/envelope.ts";
import { emit, emitError } from "../../lib/output/json.ts";
import { isColorEnabled } from "../../lib/tty.ts";

const DAY_LABELS: Record<string, string> = {
  L: "Lunes",
  M: "Martes",
  X: "Miércoles",
  J: "Jueves",
  V: "Viernes",
  S: "Sábado",
  D: "Domingo",
};

export function makeHorarioHoyCommand(): Command {
  return new Command("hoy")
    .description("Bloques de hoy (Lima time)")
    .option("--json", "Output as JSON envelope")
    .option("--profile <profile>", "Profile name", "default")
    .action(async (options) => {
      try {
        const session = await loadIntranetSession(options.profile as string);
        const horario = await fetchHorario(session);

        const dayCode = getLimaDayCode();
        const fecha = getLimaDateISO();
        const bloques = filterBloquesByDayCode(horario.dias, dayCode);

        const result = { fecha, dia: DAY_LABELS[dayCode] ?? dayCode, bloques };

        if (options.json) {
          emit(ok(result));
          return;
        }

        const color = isColorEnabled();
        const lines: string[] = [];

        const header = `Hoy — ${result.dia} ${fecha}`;
        lines.push("");
        lines.push(color ? pc.bold(pc.cyan(header)) : header);
        lines.push(color ? pc.dim("─".repeat(header.length)) : "─".repeat(header.length));
        lines.push("");

        if (bloques.length === 0) {
          lines.push(color ? pc.dim("  Sin clases hoy.") : "  Sin clases hoy.");
        } else {
          for (const b of bloques) {
            const time = color
              ? pc.green(`${b.time_start}–${b.time_end}`)
              : `${b.time_start}–${b.time_end}`;
            const code = b.course_code
              ? color
                ? pc.bold(pc.yellow(b.course_code))
                : b.course_code
              : "";
            const name = color ? pc.white(b.course_name) : b.course_name;
            const coursePart = code ? `${code}  ${name}` : name;

            lines.push(`  ${time.padEnd(color ? 22 : 11)}  ${coursePart}`);

            const parts: string[] = [];
            if (b.room) parts.push(b.room);
            if (b.building && b.building !== b.room) parts.push(b.building);
            if (b.teacher) parts.push(`Prof. ${b.teacher}`);

            if (parts.length > 0) {
              const detail = parts.join("  ·  ");
              lines.push(
                color ? `  ${" ".repeat(13)}${pc.dim(detail)}` : `  ${" ".repeat(13)}${detail}`,
              );
            }
          }
        }

        lines.push(
          renderNextSteps(
            NEXT_STEPS.afterHorario as readonly { command: string; description: string }[],
            color,
          ),
        );
        process.stdout.write(lines.join("\n"));
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
