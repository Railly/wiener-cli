// wiener planner — /api/v1/planner/items

import { fetchPlannerItems } from "../lib/api/canvas/planner.js";
import { ok } from "../lib/output/envelope.js";
import { emit } from "../lib/output/json.js";
import { emitStream } from "../lib/output/ndjson.js";
import { renderTable, renderSection, formatDate } from "../lib/output/human.js";
import { toErrorEnvelope } from "../lib/errors.js";
import { isoDateLima, weekFromNowLima } from "../lib/time.js";
import pc from "picocolors";

export async function runPlanner(opts: {
  json?: boolean;
  ndjson?: boolean;
  dias?: number;
}): Promise<void> {
  try {
    const dias = opts.dias ?? 14;
    const now = new Date();
    const { end } = weekFromNowLima(dias);

    const items = await fetchPlannerItems({
      startDate: isoDateLima(now),
      endDate: isoDateLima(end),
      perPage: 50,
    });

    const data = { items };

    if (opts.json) { emit(ok(data)); return; }

    if (opts.ndjson) {
      await emitStream((async function* () { for (const item of items) yield item; })());
      return;
    }

    if (items.length === 0) {
      console.log(pc.green("No hay items en el planner."));
      return;
    }

    const rows = items.map((item) => ({
      tipo: item.plannable_type,
      titulo: item.plannable.title ?? item.plannable.name ?? pc.dim("—"),
      fecha: formatDate(item.plannable_date),
      completado: item.planner_override?.marked_complete ? pc.green("sí") : pc.dim("no"),
      puntos: item.plannable.points_possible != null ? String(item.plannable.points_possible) : pc.dim("—"),
    }));

    console.log(renderSection(`Planner — próximos ${dias} días`, renderTable(rows, [
      { header: "Tipo", key: "tipo" },
      { header: "Título", key: "titulo", maxWidth: 50 },
      { header: "Fecha", key: "fecha" },
      { header: "Pts", key: "puntos" },
      { header: "Hecho", key: "completado" },
    ])));
  } catch (e) {
    if (opts.json) { emit(toErrorEnvelope(e)); return; }
    process.stderr.write(`Error: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
  }
}
