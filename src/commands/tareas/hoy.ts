// wiener tareas hoy — due today (America/Lima) + overdue

import { fetchUpcomingEvents } from "../../lib/api/canvas/calendar.js";
import { ok } from "../../lib/output/envelope.js";
import { emit } from "../../lib/output/json.js";
import { renderTable, renderSection, formatDate } from "../../lib/output/human.js";
import { toErrorEnvelope } from "../../lib/errors.js";
import { isToday, isPast } from "../../lib/time.js";
import pc from "picocolors";

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
      const rows = atrasadas.map((t) => ({
        id: String(t.id),
        nombre: t.name,
        vencio: formatDate(t.due_at),
        estado: t.submitted ? pc.yellow("entregado tarde") : pc.red("ATRASADA"),
      }));
      console.log(renderSection("Atrasadas", renderTable(rows, [
        { header: "ID", key: "id" },
        { header: "Nombre", key: "nombre", maxWidth: 45 },
        { header: "Venció", key: "vencio" },
        { header: "Estado", key: "estado" },
      ])));
    }

    if (hoy.length > 0) {
      const rows = hoy.map((t) => ({
        id: String(t.id),
        nombre: t.name,
        vencimiento: formatDate(t.due_at),
        estado: t.submitted ? pc.yellow("entregado") : pc.red("pendiente"),
      }));
      console.log(renderSection("Hoy", renderTable(rows, [
        { header: "ID", key: "id" },
        { header: "Nombre", key: "nombre", maxWidth: 45 },
        { header: "Vencimiento", key: "vencimiento" },
        { header: "Estado", key: "estado" },
      ])));
    }
  } catch (e) {
    if (opts.json) { emit(toErrorEnvelope(e)); return; }
    process.stderr.write(`Error: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
  }
}
