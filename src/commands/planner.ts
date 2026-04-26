// wiener planner — /api/v1/planner/items

import pc from "picocolors";
import { fetchPlannerItems } from "../lib/api/canvas/planner.js";
import { toErrorEnvelope } from "../lib/errors.js";
import { ok } from "../lib/output/envelope.js";
import { renderSection } from "../lib/output/human.js";
import { renderTable } from "../lib/output/responsive-table.js";
import { formatDueDate } from "../lib/format/date.js";
import { emit } from "../lib/output/json.js";
import { emitStream } from "../lib/output/ndjson.js";
import { isoDateLima, weekFromNowLima } from "../lib/time.js";

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

    if (opts.json) {
      emit(ok(data));
      return;
    }

    if (opts.ndjson) {
      await emitStream(
        (async function* () {
          for (const item of items) yield item;
        })(),
      );
      return;
    }

    if (items.length === 0) {
      console.log(pc.green("No hay items en el planner."));
      return;
    }

    console.log(
      renderSection(
        `Planner — próximos ${dias} días`,
        renderTable(items, [
          {
            header: "Tipo",
            get: (item) => item.plannable_type,
            fixed: 10,
            show: "wide",
            priority: 5,
          },
          {
            header: "Título",
            get: (item) => item.plannable.title ?? item.plannable.name ?? "—",
            weight: 3,
            min: 20,
            show: "always",
            priority: 9,
          },
          {
            header: "Fecha",
            get: (item) => formatDueDate(item.plannable_date),
            weight: 1,
            min: 14,
            show: "always",
            priority: 8,
          },
          {
            header: "Pts",
            get: (item) =>
              item.plannable.points_possible != null ? String(item.plannable.points_possible) : "—",
            fixed: 4,
            align: "right",
            show: "wide",
            priority: 4,
          },
          {
            header: "Hecho",
            get: (item) => (item.planner_override?.marked_complete ? "sí" : "no"),
            fixed: 6,
            color: (v) => (v === "sí" ? pc.green(v) : pc.dim(v)),
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
