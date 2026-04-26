// wiener calendario [--dias N]

import pc from "picocolors";
import { fetchCalendarEvents, fetchUpcomingEvents } from "../../lib/api/canvas/calendar.js";
import { fetchActiveCourses } from "../../lib/api/canvas/courses.js";
import { emitNextSteps } from "../../lib/agent/next-steps.js";
import { toErrorEnvelope } from "../../lib/errors.js";
import { ok } from "../../lib/output/envelope.js";
import { formatDate, renderSection, renderTable } from "../../lib/output/human.js";
import { emit } from "../../lib/output/json.js";
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

    const rows = sorted.map((e) => ({
      fecha: formatDate(e.fecha),
      tipo: e.tipo === "tarea" ? pc.red("TAREA") : pc.cyan("evento"),
      titulo: e.titulo,
      curso: e.curso,
    }));

    console.log(
      renderSection(
        `Calendario — próximos ${dias} días`,
        renderTable(rows, [
          { header: "Fecha", key: "fecha" },
          { header: "Tipo", key: "tipo" },
          { header: "Título", key: "titulo", maxWidth: 45 },
          { header: "Curso", key: "curso" },
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
