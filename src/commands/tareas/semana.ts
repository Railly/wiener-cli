// wiener tareas semana — due in next 7 days

import pc from "picocolors";
import { fetchUpcomingEvents } from "../../lib/api/canvas/calendar.js";
import { toErrorEnvelope } from "../../lib/errors.js";
import { ok } from "../../lib/output/envelope.js";
import { formatDate, renderSection, renderTable } from "../../lib/output/human.js";
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

    const rows = tareas.map((t) => ({
      id: String(t.id),
      nombre: t.name,
      vencimiento: formatDate(t.due_at),
      puntos: String(t.points),
      estado: t.submitted ? pc.yellow("entregado") : pc.red("pendiente"),
    }));

    console.log(
      renderSection(
        `Tareas — próximos ${dias} días`,
        renderTable(rows, [
          { header: "ID", key: "id" },
          { header: "Nombre", key: "nombre", maxWidth: 50 },
          { header: "Vencimiento", key: "vencimiento" },
          { header: "Pts", key: "puntos" },
          { header: "Estado", key: "estado" },
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
