// wiener anuncios [--ultimos N] — announcements across all active courses

import pc from "picocolors";
import { fetchAnnouncements } from "../../lib/api/canvas/announcements.js";
import { fetchActiveCourses } from "../../lib/api/canvas/courses.js";
import { toErrorEnvelope } from "../../lib/errors.js";
import { ok } from "../../lib/output/envelope.js";
import { formatDate, renderSection, renderTable, truncateHtml } from "../../lib/output/human.js";
import { emit } from "../../lib/output/json.js";
import { emitStream } from "../../lib/output/ndjson.js";

export async function runAnuncios(opts: {
  json?: boolean;
  ndjson?: boolean;
  full?: boolean;
  ultimos?: number;
  fields?: string;
}): Promise<void> {
  try {
    const courses = await fetchActiveCourses();
    const courseIds = courses.map((c) => c.id);
    const courseMap = new Map(courses.map((c) => [c.id, c]));

    const n = opts.ultimos ?? 5;
    const rawAnuncios = await fetchAnnouncements(courseIds, n);

    const anuncios = rawAnuncios
      .map((a) => {
        const courseId = Number.parseInt(a.context_code.replace("course_", ""), 10);
        const course = courseMap.get(courseId);
        return {
          id: a.id,
          curso: {
            code: course?.course_code ?? String(courseId),
            alias: course?.course_code?.toLowerCase() ?? String(courseId),
          },
          title: a.title,
          posted_at: a.posted_at,
          author: a.author.display_name,
          body: opts.full ? a.message : truncateHtml(a.message, 200),
          url: a.html_url,
        };
      })
      .sort((a, b) => b.posted_at.localeCompare(a.posted_at));

    const data = { anuncios };

    if (opts.json) {
      emit(ok(data));
      return;
    }
    if (opts.ndjson) {
      await emitStream(
        (async function* () {
          for (const a of anuncios) yield a;
        })(),
      );
      return;
    }

    if (anuncios.length === 0) {
      console.log(pc.dim("No hay anuncios recientes."));
      return;
    }

    const rows = anuncios.map((a) => ({
      curso: a.curso.code,
      titulo: a.title,
      fecha: formatDate(a.posted_at),
      autor: a.author,
      ...(opts.full ? { cuerpo: a.body } : {}),
    }));

    const columns = [
      { header: "Curso", key: "curso" },
      { header: "Título", key: "titulo", maxWidth: 40 },
      { header: "Fecha", key: "fecha" },
      { header: "Autor", key: "autor", maxWidth: 30 },
      ...(opts.full ? [{ header: "Mensaje", key: "cuerpo", maxWidth: 80 }] : []),
    ];

    console.log(renderSection("Anuncios", renderTable(rows, columns)));
    if (!opts.full) console.log(pc.dim("  Usa --full para ver el cuerpo completo."));
  } catch (e) {
    if (opts.json) {
      emit(toErrorEnvelope(e));
      return;
    }
    process.stderr.write(`Error: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
  }
}
