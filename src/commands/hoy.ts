import type { Command } from "commander";
import pc from "picocolors";
import { getTodo, getUpcomingEvents } from "../lib/api/canvas/calendar.js";
import { getActiveCourses } from "../lib/api/canvas/courses.js";
import { getHorarioMatriculado } from "../lib/api/intranet/horario.js";
import { getProfileAliases } from "../lib/courses/alias-store.js";
import { generateAliasMapByCodeName } from "../lib/courses/auto-alias.js";
import { groupBySection } from "../lib/courses/grouping.js";
import { err, ok } from "../lib/output/envelope.js";
import { emit } from "../lib/output/json.js";
import { isColorEnabled } from "../lib/tty.js";

const DIA_MAP: Record<number, string> = {
  0: "D",
  1: "L",
  2: "M",
  3: "X",
  4: "J",
  5: "V",
  6: "S",
};
const DIA_NOMBRES: Record<string, string> = {
  L: "Lunes",
  M: "Martes",
  X: "Miércoles",
  J: "Jueves",
  V: "Viernes",
  S: "Sábado",
  D: "Domingo",
};
const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

export function registerHoy(program: Command): void {
  program
    .command("hoy")
    .description("Horario de hoy + tareas de hoy")
    .option("--json", "output JSON envelope")
    .option("--profile <name>", "profile name", "default")
    .action(async (opts: { json?: boolean; profile?: string }) => {
      const t0 = Date.now();
      const profile = opts.profile ?? "default";
      try {
        const now = new Date();
        const diaKey = DIA_MAP[now.getDay()] ?? "L";
        const diaLabel = DIA_NOMBRES[diaKey] ?? diaKey;
        const fecha = `${diaLabel} ${now.getDate()} ${MESES[now.getMonth()]} ${now.getFullYear()}`;

        const [horario, upcomingEvents, todo, rawCourses] = await Promise.all([
          getHorarioMatriculado(profile),
          getUpcomingEvents(),
          getTodo(),
          getActiveCourses(profile),
        ]);

        const customAliases = getProfileAliases(profile);
        const autoAliases = generateAliasMapByCodeName(
          rawCourses.map((c) => ({ code: c.course_code, name: c.name })),
        );
        const aliasMap = { ...autoAliases, ...customAliases };
        const courses = groupBySection(rawCourses, aliasMap);

        const bloques = (horario.dias as Record<string, typeof horario.dias.L>)[diaKey] ?? [];

        const courseCodeMap = new Map<string, string>();
        for (const c of courses) {
          for (const s of c.secciones) courseCodeMap.set(s.id, c.code);
        }

        const todayEnd = new Date(now);
        todayEnd.setHours(23, 59, 59, 999);

        const tareasHoy = [];
        for (const ev of [...upcomingEvents, ...todo.filter((t) => t.assignment)]) {
          const dueAt = ev.assignment?.due_at ?? (ev as { start_at?: string }).start_at;
          if (!dueAt) continue;
          const due = new Date(dueAt);
          if (due <= todayEnd) {
            const courseId = ev.context_code?.replace("course_", "") ?? "0";
            tareasHoy.push({
              titulo: ev.assignment?.name ?? (ev as { title?: string }).title ?? "",
              curso: courseCodeMap.get(courseId) ?? courseId,
              due_at: due.toISOString(),
              url: ev.html_url ?? "",
            });
          }
        }

        const data = { fecha, dia: diaKey, bloques, tareas_hoy: tareasHoy };

        if (opts.json) {
          emit(ok(data, { duration_ms: Date.now() - t0 }));
          return;
        }

        const color = isColorEnabled();
        const lines: string[] = [];
        const header = `Hoy — ${fecha}`;
        lines.push(color ? pc.bold(header) : header);
        lines.push("─".repeat(header.length));
        lines.push("");
        if (bloques && Array.isArray(bloques) && bloques.length > 0) {
          for (const b of bloques) {
            lines.push(
              `  ${b.time_start}-${b.time_end}  ${b.course_code} · ${b.course_name}  ${b.room}`,
            );
          }
        } else {
          lines.push(color ? pc.dim("  Sin clases hoy.") : "  Sin clases hoy.");
        }
        if (tareasHoy.length > 0) {
          lines.push("");
          lines.push(color ? pc.bold("Tareas hoy") : "Tareas hoy");
          for (const t of tareasHoy) {
            lines.push(
              `  ${t.curso}  ${t.titulo}  ${new Date(t.due_at).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}`,
            );
          }
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
