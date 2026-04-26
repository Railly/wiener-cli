import { getHorarioMatriculado } from "../lib/api/intranet/horario.js";
import { emit } from "../lib/output/json.js";
import { ok, err } from "../lib/output/envelope.js";
import { isColorEnabled } from "../lib/tty.js";
import pc from "picocolors";
import type { Command } from "commander";
import type { HorarioBloque } from "../types/intranet.js";

const DIA_MAP: Record<number, string> = {
  0: "D", 1: "L", 2: "M", 3: "X", 4: "J", 5: "V", 6: "S",
};

function timeToMinutes(t: string): number {
  const [hh, mm] = t.split(":").map(Number);
  return (hh ?? 0) * 60 + (mm ?? 0);
}

export function registerAhora(program: Command): void {
  program
    .command("ahora")
    .description("Bloque actual y próximo con ETA")
    .option("--json", "output JSON envelope")
    .action(async (opts: { json?: boolean }) => {
      const t0 = Date.now();
      try {
        const now = new Date();
        const diaKey = DIA_MAP[now.getDay()] ?? "L";
        const horario = await getHorarioMatriculado();
        const bloques = ((horario.dias as Record<string, HorarioBloque[] | undefined>)[diaKey] ?? []) as HorarioBloque[];
        const nowMins = now.getHours() * 60 + now.getMinutes();

        const sorted = [...bloques].sort(
          (a, b) => timeToMinutes(a.time_start) - timeToMinutes(b.time_start)
        );

        let ahora: HorarioBloque | null = null;
        let proximo: HorarioBloque | null = null;
        let eta_minutos: number | null = null;

        for (const b of sorted) {
          const start = timeToMinutes(b.time_start);
          const end = timeToMinutes(b.time_end);
          if (nowMins >= start && nowMins < end) {
            ahora = b;
          } else if (nowMins < start && !proximo) {
            proximo = b;
            eta_minutos = start - nowMins;
          }
        }

        const data = { ahora, proximo, eta_minutos };

        if (opts.json) {
          emit(ok(data, { duration_ms: Date.now() - t0 }));
          return;
        }

        const color = isColorEnabled();
        const lines: string[] = [];
        if (ahora) {
          const label = color ? pc.bold("Ahora") : "Ahora";
          lines.push(`${label}    ${ahora.course_code} · ${ahora.course_name}`);
          lines.push(`         ${ahora.time_start}-${ahora.time_end} · ${ahora.type} · ${ahora.room}`);
        } else {
          lines.push(color ? pc.dim("Sin clase en este momento.") : "Sin clase en este momento.");
        }
        if (proximo) {
          const etaH = Math.floor((eta_minutos ?? 0) / 60);
          const etaM = (eta_minutos ?? 0) % 60;
          const etaStr = etaH > 0 ? `${etaH}h ${etaM}m` : `${etaM}m`;
          const label = color ? pc.bold("Próximo") : "Próximo";
          lines.push(`${label}  ${proximo.course_code} · ${proximo.course_name}  ${color ? pc.yellow(`(en ${etaStr})`) : `(en ${etaStr})`}`);
          lines.push(`         ${proximo.time_start}-${proximo.time_end} · ${proximo.type} · ${proximo.room}`);
        }
        lines.push("");
        process.stdout.write(lines.join("\n"));
      } catch (e) {
        if (opts.json) {
          emit(err("error", String(e)));
        } else {
          process.stderr.write(`Error: ${e}\n`);
        }
        process.exit(1);
      }
    });
}
