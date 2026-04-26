import { Command } from "commander";
import { fetchHorario } from "../../lib/api/intranet/horario.ts";
import { loadIntranetSession } from "../../lib/auth/store.ts";
import { isWienerError } from "../../lib/errors.ts";
import {
  bloqueContainsNow,
  filterBloquesByDayCode,
  getLimaDayCode,
  getLimaTimeMinutes,
  minutesUntilBloque,
  sortBloquesByTime,
} from "../../lib/horario-time.ts";
import { err, ok } from "../../lib/output/envelope.ts";
import { emit, emitError } from "../../lib/output/json.ts";
import type { DiaCode, HorarioBloque } from "../../types/intranet.ts";

const DAY_ORDER: DiaCode[] = ["L", "M", "X", "J", "V", "S", "D"];

export function makeHorarioAhoraCommand(): Command {
  return new Command("ahora")
    .description("Bloque actual y próximo (Lima time)")
    .option("--json", "Output as JSON envelope")
    .option("--profile <profile>", "Profile name", "default")
    .action(async (options) => {
      try {
        const session = await loadIntranetSession(options.profile as string);
        const horario = await fetchHorario(session);

        const dayCode = getLimaDayCode();
        const nowMinutes = getLimaTimeMinutes();

        const todayBloques = filterBloquesByDayCode(horario.dias, dayCode);

        let ahora: HorarioBloque | null = null;
        let proximo: HorarioBloque | null = null;
        let etaMinutos: number | undefined;

        // Find current bloque
        for (const bloque of todayBloques) {
          if (bloqueContainsNow(bloque, nowMinutes)) {
            ahora = bloque;
            break;
          }
        }

        // Find next bloque — today first, then next days in week
        const todayIdx = DAY_ORDER.indexOf(dayCode);
        const futureTodayBloques = todayBloques.filter(
          (b) => minutesUntilBloque(b, nowMinutes) > 0,
        );

        if (futureTodayBloques.length > 0 && futureTodayBloques[0]) {
          proximo = futureTodayBloques[0];
          etaMinutos = minutesUntilBloque(proximo, nowMinutes);
        } else {
          // Look ahead up to 7 days
          for (let offset = 1; offset <= 7 && !proximo; offset++) {
            const nextDayCode = DAY_ORDER[(todayIdx + offset) % 7];
            if (!nextDayCode) continue;
            const nextBloques = sortBloquesByTime(horario.dias[nextDayCode] ?? []);
            if (nextBloques.length > 0 && nextBloques[0]) {
              proximo = nextBloques[0];
              const minutesUntilMidnight = 24 * 60 - nowMinutes;
              const fullDays = offset - 1;
              const minutesIntoDay = minutesUntilBloque(proximo, 0);
              etaMinutos = minutesUntilMidnight + fullDays * 24 * 60 + minutesIntoDay;
            }
          }
        }

        const result = {
          ahora,
          proximo,
          ...(etaMinutos !== undefined ? { eta_minutos: etaMinutos } : {}),
        };

        if (options.json) {
          emit(ok(result));
          return;
        }

        if (ahora) {
          const time = `${ahora.time_start}–${ahora.time_end}`;
          const course = ahora.course_code
            ? `${ahora.course_code} · ${ahora.course_name}`
            : ahora.course_name;
          console.log(`\nAhora: ${time} ${course}`);
          if (ahora.room)
            console.log(`       ${ahora.room}${ahora.teacher ? ` · ${ahora.teacher}` : ""}`);
        } else {
          console.log("\nAhora: Sin clase en curso");
        }

        if (proximo) {
          const time = `${proximo.time_start}–${proximo.time_end}`;
          const course = proximo.course_code
            ? `${proximo.course_code} · ${proximo.course_name}`
            : proximo.course_name;
          const eta =
            etaMinutos !== undefined
              ? ` (en ${etaMinutos >= 60 ? `${Math.floor(etaMinutos / 60)}h ${etaMinutos % 60}m` : `${etaMinutos}m`})`
              : "";
          console.log(`Próximo: ${time} ${course}${eta}`);
          if (proximo.room)
            console.log(
              `         ${proximo.room}${proximo.teacher ? ` · ${proximo.teacher}` : ""}`,
            );
        } else {
          console.log("Próximo: Sin clases próximas");
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
