// wiener anuncios globales — account-level announcements

import pc from "picocolors";
import { fetchGlobalAnnouncements } from "../../lib/api/canvas/announcements.js";
import { toErrorEnvelope } from "../../lib/errors.js";
import { formatDueDate } from "../../lib/format/date.js";
import { ok } from "../../lib/output/envelope.js";
import { renderSection, truncateHtml } from "../../lib/output/human.js";
import { emit } from "../../lib/output/json.js";
import { renderTable } from "../../lib/output/responsive-table.js";

export async function runAnunciosGlobales(opts: {
  json?: boolean;
  full?: boolean;
}): Promise<void> {
  try {
    const rawAnuncios = await fetchGlobalAnnouncements("auto");

    const anuncios = rawAnuncios
      .map((a) => ({
        id: a.id,
        title: a.title,
        posted_at: a.posted_at,
        author: a.author.display_name,
        body: opts.full ? a.message : truncateHtml(a.message, 200),
        url: a.html_url,
      }))
      .sort((a, b) => b.posted_at.localeCompare(a.posted_at));

    const data = { anuncios };

    if (opts.json) {
      emit(ok(data));
      return;
    }

    if (anuncios.length === 0) {
      console.log(
        pc.dim("No hay anuncios globales. (La cuenta institucional puede tener ID distinto a 1.)"),
      );
      console.log(pc.dim("Needs validation: account_id may not be 1 for Wiener Canvas instance."));
      return;
    }

    const baseColumns = [
      {
        header: "Título",
        get: (a: (typeof anuncios)[number]) => a.title,
        weight: 2,
        min: 20,
        show: "always" as const,
        priority: 9,
      },
      {
        header: "Fecha",
        get: (a: (typeof anuncios)[number]) => formatDueDate(a.posted_at),
        weight: 1,
        min: 14,
        show: "wide" as const,
        priority: 6,
      },
      {
        header: "Autor",
        get: (a: (typeof anuncios)[number]) => a.author,
        weight: 1,
        min: 12,
        max: 25,
        show: "wide" as const,
        priority: 4,
      },
    ];

    const columns = opts.full
      ? [
          ...baseColumns,
          {
            header: "Mensaje",
            get: (a: (typeof anuncios)[number]) => a.body,
            weight: 3,
            min: 20,
            show: "always" as const,
            priority: 7,
          },
        ]
      : baseColumns;

    console.log(renderSection("Anuncios globales", renderTable(anuncios, columns)));
  } catch (e) {
    if (opts.json) {
      emit(toErrorEnvelope(e));
      return;
    }
    process.stderr.write(`Error: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
  }
}
