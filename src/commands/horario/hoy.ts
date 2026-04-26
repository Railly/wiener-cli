import { Command } from "commander";
import { fetchHorario } from "../../lib/api/intranet/horario.ts";
import { loadIntranetSession } from "../../lib/auth/store.ts";
import { isWienerError } from "../../lib/errors.ts";
import { filterBloquesByDayCode, getLimaDateISO, getLimaDayCode } from "../../lib/horario-time.ts";
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

        console.log(`\nHoy — ${result.dia} ${fecha}`);
        if (bloques.length === 0) {
          console.log("  Sin clases hoy.");
          return;
        }
        for (const b of bloques) {
          const time = `${b.time_start}–${b.time_end}`;
          const course = b.course_code ? `${b.course_code} · ${b.course_name}` : b.course_name;
          const location = [b.room, b.building].filter(Boolean).join(", ");
          console.log(`  ${time.padEnd(14)} ${course}`);
          if (location || b.teacher) {
            console.log(`  ${"".padEnd(14)} ${[location, b.teacher].filter(Boolean).join(" · ")}`);
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
}
