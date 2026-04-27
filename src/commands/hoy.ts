import type { Command } from "commander";
import pc from "picocolors";
import { NEXT_STEPS, renderNextSteps } from "../lib/agent/next-steps.js";
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

function formatDueTime(isoDate: string): string {
  const d = new Date(isoDate);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

function formatDueLabel(isoDate: string, color: boolean): string {
  const due = new Date(isoDate);
  const now = new Date();
  const diffMs = due.getTime() - now.getTime();
  const timeStr = formatDueTime(isoDate);

  if (diffMs < 0) {
    const label = `atrasada (${timeStr})`;
    return color ? pc.bold(pc.red(label)) : label;
  }
  const diffHrs = diffMs / (1000 * 3600);
  if (diffHrs < 6) {
    const label = `vence ${timeStr} (¡en ${Math.round(diffHrs * 60)}m!)`;
    return color ? pc.bold(pc.red(label)) : label;
  }
  if (diffHrs < 24) {
    const label = `vence hoy ${timeStr}`;
    return color ? pc.yellow(label) : label;
  }
  return color ? pc.dim(`vence ${timeStr}`) : `vence ${timeStr}`;
}

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

        // Header
        lines.push("");
        const header = `Hoy — ${fecha}`;
        lines.push(color ? pc.bold(pc.cyan(header)) : header);
        lines.push(
          color
            ? pc.dim("─".repeat(Math.max(header.length, 40)))
            : "─".repeat(Math.max(header.length, 40)),
        );
        lines.push("");

        // Bloques
        if (bloques && Array.isArray(bloques) && bloques.length > 0) {
          const secHeader = "Clases";
          lines.push(color ? `  ${pc.bold(secHeader)}` : `  ${secHeader}`);
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
            lines.push(`    ${time.padEnd(color ? 22 : 11)}  ${coursePart}`);

            const parts: string[] = [];
            if (b.room) parts.push(b.room);
            if (b.building && b.building !== b.room) parts.push(b.building);
            if (b.teacher) parts.push(`Prof. ${b.teacher}`);
            if (parts.length > 0) {
              lines.push(
                color
                  ? `    ${" ".repeat(13)}${pc.dim(parts.join("  ·  "))}`
                  : `    ${" ".repeat(13)}${parts.join("  ·  ")}`,
              );
            }
          }
        } else {
          lines.push(color ? pc.dim("  Sin clases hoy.") : "  Sin clases hoy.");
        }

        // Tareas hoy
        if (tareasHoy.length > 0) {
          lines.push("");
          const tHeader = "Entregas hoy";
          lines.push(color ? `  ${pc.bold(pc.cyan(tHeader))}` : `  ${tHeader}`);
          lines.push(
            color ? `  ${pc.dim("─".repeat(tHeader.length))}` : `  ${"─".repeat(tHeader.length)}`,
          );
          for (const t of tareasHoy) {
            const curso = color ? pc.bold(pc.yellow(t.curso.padEnd(10))) : t.curso.padEnd(10);
            const titulo = color ? pc.white(t.titulo) : t.titulo;
            const due = formatDueLabel(t.due_at, color);
            lines.push(`    ${curso}  ${titulo}`);
            lines.push(
              color ? `    ${" ".repeat(12)}${pc.dim(due)}` : `    ${" ".repeat(12)}${due}`,
            );
          }
        }

        lines.push(
          renderNextSteps(
            NEXT_STEPS.afterHoy as readonly { command: string; description: string }[],
            color,
          ),
        );
        process.stdout.write(lines.join("\n"));
      } catch (e) {
        if (opts.json) {
          emit(err("error", String(e)));
        } else {
          process.stderr.write(
            `${pc.red("error:")} ${e instanceof Error ? e.message : String(e)}\n`,
          );
          process.stderr.write(
            renderNextSteps(
              NEXT_STEPS.authRequired as readonly { command: string; description: string }[],
              isColorEnabled(),
            ),
          );
        }
        process.exit(1);
      }
    });
}
