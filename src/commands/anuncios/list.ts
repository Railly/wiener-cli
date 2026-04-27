// wiener anuncios [--ultimos N] — announcements across all active courses

import pc from "picocolors";
import { fetchAnnouncements } from "../../lib/api/canvas/announcements.js";
import { fetchActiveCourses } from "../../lib/api/canvas/courses.js";
import { toErrorEnvelope } from "../../lib/errors.js";
import { formatDueDate } from "../../lib/format/date.js";
import { ok } from "../../lib/output/envelope.js";
import { renderSection, truncateHtml } from "../../lib/output/human.js";
import { emit } from "../../lib/output/json.js";
import { emitStream } from "../../lib/output/ndjson.js";
import { renderTable } from "../../lib/output/responsive-table.js";

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

    const baseColumns = [
      {
        header: "Curso",
        get: (a: (typeof anuncios)[number]) => a.curso.code,
        fixed: 12,
        show: "always" as const,
        priority: 10,
      },
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

    const fullColumns = opts.full
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

    console.log(renderSection("Anuncios", renderTable(anuncios, fullColumns)));
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
