// wiener tareas hoy — due today (America/Lima) + overdue

import pc from "picocolors";
import { NEXT_STEPS, emitNextSteps } from "../../lib/agent/next-steps.js";
import { fetchUpcomingEvents } from "../../lib/api/canvas/calendar.js";
import { toErrorEnvelope } from "../../lib/errors.js";
import { ok } from "../../lib/output/envelope.js";
import { formatDate, renderSection, renderTable } from "../../lib/output/human.js";
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
      emitNextSteps(
        NEXT_STEPS.afterTareasHoy as readonly { command: string; description: string }[],
      );
      return;
    }

    if (atrasadas.length > 0) {
      const rows = atrasadas.map((t) => ({
        id: String(t.id),
        nombre: pc.bold(t.name),
        vencio: pc.bold(pc.red(formatDate(t.due_at))),
        estado: t.submitted ? pc.yellow("entregado tarde") : pc.bold(pc.red("ATRASADA")),
      }));
      console.log(
        renderSection(
          pc.bold(pc.red("Atrasadas")),
          renderTable(rows, [
            { header: "ID", key: "id" },
            { header: "Nombre", key: "nombre", maxWidth: 45 },
            { header: "Venció", key: "vencio" },
            { header: "Estado", key: "estado" },
          ]),
        ),
      );
    }

    if (hoy.length > 0) {
      const rows = hoy.map((t) => ({
        id: String(t.id),
        nombre: t.name,
        vencimiento: formatDate(t.due_at),
        estado: t.submitted ? pc.yellow("entregado") : pc.red("pendiente"),
      }));
      console.log(
        renderSection(
          pc.bold(pc.yellow("Hoy")),
          renderTable(rows, [
            { header: "ID", key: "id" },
            { header: "Nombre", key: "nombre", maxWidth: 45 },
            { header: "Vencimiento", key: "vencimiento" },
            { header: "Estado", key: "estado" },
          ]),
        ),
      );
    }

    emitNextSteps(NEXT_STEPS.afterTareasHoy as readonly { command: string; description: string }[]);
  } catch (e) {
    if (opts.json) {
      emit(toErrorEnvelope(e));
      return;
    }
    process.stderr.write(`${pc.red("error:")} ${e instanceof Error ? e.message : String(e)}\n`);
    emitNextSteps(NEXT_STEPS.canvasRequired as readonly { command: string; description: string }[]);
    process.exit(1);
  }
}
