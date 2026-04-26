import { Command } from "commander";
import pc from "picocolors";
import { NEXT_STEPS, renderNextSteps } from "../../lib/agent/next-steps.ts";
import { fetchHorario } from "../../lib/api/intranet/horario.ts";
import { loadIntranetSession } from "../../lib/auth/store.ts";
import { isWienerError } from "../../lib/errors.ts";
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

export function makeHorarioCommand(): Command {
  const cmd = new Command("horario")
    .description("Horario semanal matriculado (intranet)")
    .option("--json", "Output as JSON envelope")
    .option("--profile <profile>", "Profile name", "default")
    .action(async (options) => {
      try {
        const session = await loadIntranetSession(options.profile as string);
        const data = await fetchHorario(session);

        if (options.json) {
          emit(ok(data));
          return;
        }

        const color = isColorEnabled();
        const lines: string[] = [];

        const header = `Horario semanal${data.semana ? ` — ${data.semana}` : ""}`;
        lines.push("");
        lines.push(color ? pc.bold(pc.cyan(header)) : header);
        lines.push(color ? pc.dim("─".repeat(50)) : "─".repeat(50));

        const days = ["L", "M", "X", "J", "V", "S"] as const;
        for (const day of days) {
          const bloques = data.dias[day];
          if (!bloques || bloques.length === 0) continue;

          lines.push("");
          const dayLabel = DAY_LABELS[day] ?? day;
          lines.push(color ? `  ${pc.bold(dayLabel)}` : `  ${dayLabel}`);

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
            const section = b.section ? `  ${b.section}` : "";
            const coursePart = code ? `${code}${section}  ${name}` : name;

            lines.push(`    ${time.padEnd(color ? 22 : 11)}  ${coursePart}`);

            const parts: string[] = [];
            if (b.room) parts.push(b.room);
            if (b.building && b.building !== b.room) parts.push(b.building);
            if (b.teacher) parts.push(`Prof. ${b.teacher}`);
            if (b.type) parts.push(b.type);

            if (parts.length > 0) {
              const detail = parts.join("  ·  ");
              lines.push(
                color ? `    ${" ".repeat(13)}${pc.dim(detail)}` : `    ${" ".repeat(13)}${detail}`,
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

  return cmd;
}
