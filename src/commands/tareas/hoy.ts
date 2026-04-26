// wiener tareas hoy — due today (America/Lima) + overdue

import pc from "picocolors";
import { fetchUpcomingEvents } from "../../lib/api/canvas/calendar.js";
import { toErrorEnvelope } from "../../lib/errors.js";
import { ok } from "../../lib/output/envelope.js";
import { renderSection } from "../../lib/output/human.js";
import { renderTable } from "../../lib/output/responsive-table.js";
import { formatDueDate } from "../../lib/format/date.js";
import { emit } from "../../lib/output/json.js";
import { isPast, isToday } from "../../lib/time.js";

export async function runTareasHoy(opts: { json?: boolean; fields?: string }): Promise<void> {
  try {
    const events = await fetchUpcomingEvents();

    const atrasadasRaw = events.filter((e) => e.assignment && isPast(e.assignment.due_at));
    const hoyRaw = events.filter((e) => e.assignment && isToday(e.assignment.due_at));

    function toItem(ev: (typeof events)[number]) {
      const a = ev.assignment!;
      return {
        id: a.id,
        name: a.name,
        due_at: a.due_at ?? null,
        points: a.points_possible,
        url: a.html_url,
        submitted: a.submission?.workflow_state !== "unsubmitted" ?? false,
      };
    }

    const atrasadas = atrasadasRaw.map(toItem);
    const hoy = hoyRaw.map(toItem);
    const data = { atrasadas, hoy };

    if (opts.json) {
      emit(ok(data));
      return;
    }

    if (atrasadas.length === 0 && hoy.length === 0) {
      console.log(pc.green("No hay tareas vencidas ni para hoy."));
      return;
    }

    if (atrasadas.length > 0) {
      console.log(
        renderSection(
          "Atrasadas",
          renderTable(atrasadas, [
            {
              header: "Tarea",
              get: (t) => t.name,
              weight: 3,
              min: 20,
              show: "always",
              priority: 9,
            },
            {
              header: "Venció",
              get: (t) => formatDueDate(t.due_at),
              weight: 1,
              min: 14,
              show: "always",
              priority: 8,
            },
            {
              header: "Estado",
              get: (t) => (t.submitted ? "entregado tarde" : "ATRASADA"),
              fixed: 14,
              color: (v) => (v === "entregado tarde" ? pc.yellow(v) : pc.red(pc.bold(v))),
              show: "always",
              priority: 7,
            },
          ]),
        ),
      );
    }

    if (hoy.length > 0) {
      console.log(
        renderSection(
          "Hoy",
          renderTable(hoy, [
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
    }
  } catch (e) {
    if (opts.json) {
      emit(toErrorEnvelope(e));
      return;
    }
    process.stderr.write(`Error: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
  }
}
