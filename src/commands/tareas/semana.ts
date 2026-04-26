// wiener tareas semana — due in next 7 days

import pc from "picocolors";
import { fetchUpcomingEvents } from "../../lib/api/canvas/calendar.js";
import { toErrorEnvelope } from "../../lib/errors.js";
import { ok } from "../../lib/output/envelope.js";
import { renderSection } from "../../lib/output/human.js";
import { renderTable } from "../../lib/output/responsive-table.js";
import { formatDueDate } from "../../lib/format/date.js";
import { emit } from "../../lib/output/json.js";
import { isWithinDays } from "../../lib/time.js";

export async function runTareasSemana(opts: { json?: boolean; dias?: number }): Promise<void> {
  try {
    const dias = opts.dias ?? 7;
    const events = await fetchUpcomingEvents();

    const tareasRaw = events.filter((e) => e.assignment && isWithinDays(e.assignment.due_at, dias));

    const tareas = tareasRaw.map((ev) => {
      const a = ev.assignment!;
      return {
        id: a.id,
        name: a.name,
        due_at: a.due_at ?? null,
        points: a.points_possible,
        url: a.html_url,
        submitted: a.submission?.workflow_state !== "unsubmitted" ?? false,
      };
    });

    const data = { tareas, dias };

    if (opts.json) {
      emit(ok(data));
      return;
    }

    if (tareas.length === 0) {
      console.log(pc.green(`No hay tareas en los próximos ${dias} días.`));
      return;
    }

    console.log(
      renderSection(
        `Tareas — próximos ${dias} días`,
        renderTable(tareas, [
          {
            header: "Tarea",
            get: (t) => t.name,
            weight: 3,
            min: 20,
            show: "always",
            priority: 9,
          },
          {
            header: "Vence",
            get: (t) => formatDueDate(t.due_at),
            weight: 1,
            min: 14,
            show: "always",
            priority: 8,
          },
          {
            header: "Pts",
            get: (t) => (t.points > 0 ? String(t.points) : "—"),
            fixed: 4,
            align: "right",
            show: "wide",
            priority: 3,
          },
          {
            header: "Estado",
            get: (t) => (t.submitted ? "entregado" : "pendiente"),
            fixed: 11,
            color: (v) => (v === "entregado" ? pc.cyan(v) : pc.yellow(v)),
            show: "always",
            priority: 7,
          },
        ]),
      ),
    );
  } catch (e) {
    if (opts.json) {
      emit(toErrorEnvelope(e));
      return;
    }
    process.stderr.write(`Error: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
  }
}
