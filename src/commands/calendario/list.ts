// wiener calendario [--dias N]

import pc from "picocolors";
import { emitNextSteps } from "../../lib/agent/next-steps.js";
import { fetchCalendarEvents, fetchUpcomingEvents } from "../../lib/api/canvas/calendar.js";
import { fetchActiveCourses } from "../../lib/api/canvas/courses.js";
import { toErrorEnvelope } from "../../lib/errors.js";
import { formatDueDate } from "../../lib/format/date.js";
import { ok } from "../../lib/output/envelope.js";
import { renderSection } from "../../lib/output/human.js";
import { emit } from "../../lib/output/json.js";
import { renderTable } from "../../lib/output/responsive-table.js";
import { isoDateLima, weekFromNowLima } from "../../lib/time.js";

export async function runCalendario(opts: {
  json?: boolean;
  dias?: number;
}): Promise<void> {
  try {
    const dias = opts.dias ?? 7;
    const now = new Date();
    const { end } = weekFromNowLima(dias);

    const courses = await fetchActiveCourses();
    const contextCodes = courses.map((c) => `course_${c.id}`);
    const courseMap = new Map(courses.map((c) => [c.id, c]));

    const [calEvents, upcomingEvents] = await Promise.all([
      fetchCalendarEvents({
        contextCodes,
        startDate: isoDateLima(now),
        endDate: isoDateLima(end),
        perPage: 100,
      }),
      fetchUpcomingEvents(),
    ]);

    const eventos: Array<{
      fecha: string | null;
      tipo: string;
      titulo: string;
      curso: string;
      url: string;
    }> = [];

    for (const ev of calEvents) {
      const courseId = Number.parseInt(ev.context_code.replace("course_", ""), 10);
      const course = courseMap.get(courseId);
      eventos.push({
        fecha: ev.start_at ?? null,
        tipo: "evento",
        titulo: ev.title,
        curso: course?.course_code ?? String(courseId),
        url: ev.html_url,
      });
    }

    for (const ev of upcomingEvents) {
      if (!ev.assignment) continue;
      const a = ev.assignment;
      const courseId = a.course_id;
      const course = courseMap.get(courseId);
      eventos.push({
        fecha: a.due_at ?? null,
        tipo: "tarea",
        titulo: a.name,
        curso: course?.course_code ?? String(courseId),
        url: a.html_url,
      });
    }

    const sorted = eventos.sort((a, b) => (a.fecha ?? "").localeCompare(b.fecha ?? ""));
    const data = { eventos: sorted, dias };

    if (opts.json) {
      emit(ok(data));
      return;
    }

    if (sorted.length === 0) {
      console.log(pc.green(`No hay eventos en los próximos ${dias} días.`));
      return;
    }

    console.log(
      renderSection(
        `Calendario — próximos ${dias} días`,
        renderTable(sorted, [
          {
            header: "Fecha",
            get: (e) => formatDueDate(e.fecha),
            weight: 1,
            min: 14,
            show: "always",
            priority: 8,
          },
          {
            header: "Tipo",
            get: (e) => e.tipo,
            fixed: 7,
            color: (v) => (v === "tarea" ? pc.red("TAREA") : pc.cyan("evento")),
            show: "always",
            priority: 10,
          },
          {
            header: "Título",
            get: (e) => e.titulo,
            weight: 3,
            min: 20,
            show: "always",
            priority: 9,
          },
          {
            header: "Curso",
            get: (e) => e.curso,
            fixed: 12,
            show: "wide",
            priority: 5,
          },
        ]),
      ),
    );

    emitNextSteps([
      { command: "wiener tareas hoy", description: "qué hay que entregar hoy" },
      { command: `wiener calendario --ics`, description: "exportar como .ics", optional: true },
    ]);
  } catch (e) {
    if (opts.json) {
      emit(toErrorEnvelope(e));
      return;
    }
    process.stderr.write(`Error: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
  }
}
