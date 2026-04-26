import { getHorarioMatriculado } from "../lib/api/intranet/horario.js";
import { getUpcomingEvents, getTodo } from "../lib/api/canvas/calendar.js";
import { getActiveCourses } from "../lib/api/canvas/courses.js";
import { emit } from "../lib/output/json.js";
import { ok, err } from "../lib/output/envelope.js";
import { isColorEnabled } from "../lib/tty.js";
import pc from "picocolors";
import type { Command } from "commander";

const DIA_LABELS: Record<string, string> = {
  L: "Lunes", M: "Martes", X: "Miércoles", J: "Jueves", V: "Viernes", S: "Sábado", D: "Domingo",
};

export function registerSemana(program: Command): void {
  program
    .command("semana")
    .description("Horario semana + tareas + quizzes próximos 7 días")
    .option("--json", "output JSON envelope")
    .action(async (opts: { json?: boolean }) => {
      const t0 = Date.now();
      try {
        const now = new Date();
        const weekEnd = new Date(now);
        weekEnd.setDate(weekEnd.getDate() + 7);

        const [horario, upcomingEvents, todo, courses] = await Promise.all([
          getHorarioMatriculado(),
          getUpcomingEvents(),
          getTodo(),
          getActiveCourses(),
        ]);

        const courseCodeMap = new Map<number, string>();
        for (const c of courses) {
          for (const s of c.secciones) courseCodeMap.set(s.id, c.code);
        }

        const tareas = [];
        const quizzes = [];
        for (const ev of [...upcomingEvents, ...todo.filter((t) => t.assignment)]) {
          const dueAt = ev.assignment?.due_at ?? (ev as { start_at?: string }).start_at;
          if (!dueAt) continue;
          const due = new Date(dueAt);
          if (due >= now && due <= weekEnd) {
            const courseId = Number(ev.context_code?.replace("course_", "") ?? "0");
            const item = {
              titulo: ev.assignment?.name ?? (ev as { title?: string }).title ?? "",
              curso: courseCodeMap.get(courseId) ?? String(courseId),
              due_at: due.toISOString(),
              url: ev.html_url ?? "",
            };
            const isQuiz = (ev.assignment?.submission_types ?? []).includes("online_quiz") ||
              (ev as { type?: string }).type === "quiz";
            if (isQuiz) quizzes.push(item);
            else tareas.push(item);
          }
        }

        const data = { semana: horario.semana, dias: horario.dias, tareas, quizzes };

        if (opts.json) {
          emit(ok(data, { duration_ms: Date.now() - t0 }));
          return;
        }

        const color = isColorEnabled();
        const lines: string[] = [];
        lines.push(color ? pc.bold(`Semana ${horario.semana}`) : `Semana ${horario.semana}`);
        lines.push("─".repeat(20));
        for (const [dia, bloques] of Object.entries(horario.dias)) {
          if (!bloques || (bloques as unknown[]).length === 0) continue;
          lines.push(`\n${color ? pc.bold(DIA_LABELS[dia] ?? dia) : (DIA_LABELS[dia] ?? dia)}`);
          for (const b of (bloques as typeof horario.dias.L ?? [])) {
            lines.push(`  ${b.time_start}-${b.time_end}  ${b.course_code} · ${b.course_name}  ${b.room}`);
          }
        }
        if (tareas.length > 0) {
          lines.push(`\n${color ? pc.bold("Tareas") : "Tareas"}`);
          for (const t of tareas) {
            const due = new Date(t.due_at).toLocaleDateString("es-PE", { weekday: "short", day: "2-digit", month: "short" });
            lines.push(`  ${t.curso}  ${t.titulo}  ${due}`);
          }
        }
        if (quizzes.length > 0) {
          lines.push(`\n${color ? pc.bold("Quizzes") : "Quizzes"}`);
          for (const q of quizzes) {
            const due = new Date(q.due_at).toLocaleDateString("es-PE", { weekday: "short", day: "2-digit", month: "short" });
            lines.push(`  ${q.curso}  ${q.titulo}  ${due}`);
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
