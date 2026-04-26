import { Command } from "commander";
import { fetchHorario } from "../../lib/api/intranet/horario.ts";
import { loadIntranetSession } from "../../lib/auth/store.ts";
import { isWienerError } from "../../lib/errors.ts";
import { err, ok } from "../../lib/output/envelope.ts";
import { emit, emitError } from "../../lib/output/json.ts";

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

        console.log(`\nHorario semanal${data.semana ? ` — ${data.semana}` : ""}`);
        const days = ["L", "M", "X", "J", "V", "S"] as const;
        for (const day of days) {
          const bloques = data.dias[day];
          if (!bloques || bloques.length === 0) continue;
          console.log(`\n  ${DAY_LABELS[day] ?? day}`);
          for (const b of bloques) {
            const time = `${b.time_start}–${b.time_end}`;
            const course = b.course_code ? `${b.course_code} · ${b.course_name}` : b.course_name;
            const location = [b.room, b.building].filter(Boolean).join(", ");
            console.log(`    ${time.padEnd(14)} ${course}`);
            if (location)
              console.log(`    ${"".padEnd(14)} ${location}${b.teacher ? ` · ${b.teacher}` : ""}`);
          }
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
