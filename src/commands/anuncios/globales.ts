// wiener anuncios globales — account-level announcements

import pc from "picocolors";
import { fetchGlobalAnnouncements } from "../../lib/api/canvas/announcements.js";
import { toErrorEnvelope } from "../../lib/errors.js";
import { ok } from "../../lib/output/envelope.js";
import { formatDate, renderSection, renderTable, truncateHtml } from "../../lib/output/human.js";
import { emit } from "../../lib/output/json.js";

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

    const rows = anuncios.map((a) => ({
      titulo: a.title,
      fecha: formatDate(a.posted_at),
      autor: a.author,
      ...(opts.full ? { cuerpo: a.body } : {}),
    }));

    console.log(
      renderSection(
        "Anuncios globales",
        renderTable(rows, [
          { header: "Título", key: "titulo", maxWidth: 50 },
          { header: "Fecha", key: "fecha" },
          { header: "Autor", key: "autor", maxWidth: 30 },
          ...(opts.full ? [{ header: "Mensaje", key: "cuerpo", maxWidth: 80 }] : []),
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
