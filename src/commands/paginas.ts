// wiener paginas <ref>

import pc from "picocolors";
import { fetchActiveCourses } from "../lib/api/canvas/courses.js";
import { fetchPage, fetchPages } from "../lib/api/canvas/pages.js";
import { groupBySection } from "../lib/courses/grouping.js";
import { resolveCourse } from "../lib/courses/resolver.js";
import { toErrorEnvelope } from "../lib/errors.js";
import { formatDueDate } from "../lib/format/date.js";
import { err, ok } from "../lib/output/envelope.js";
import { htmlToText, renderSection } from "../lib/output/human.js";
import { emit } from "../lib/output/json.js";
import { renderTable } from "../lib/output/responsive-table.js";
import { pMap } from "../lib/parallel.js";
import type { SectionType } from "../types/course.js";

export async function runPaginas(
  ref: string,
  opts: {
    json?: boolean;
    full?: boolean;
    seccion?: SectionType;
    exact?: boolean;
    noInput?: boolean;
  },
): Promise<void> {
  try {
    const canvasCourses = await fetchActiveCourses();
    const logical = groupBySection(canvasCourses);
    const resolution = resolveCourse(ref, logical, { exact: opts.exact, noInput: opts.noInput });

    if (resolution.kind === "no-match" || resolution.kind === "ambiguous") {
      const errEnv = err("course-not-found", `No course matching "${ref}"`);
      if (opts.json) {
        emit(errEnv);
        return;
      }
      process.stderr.write(`No course matching "${ref}"\n`);
      process.exit(1);
      return;
    }

    const resolvedCourse = resolution.course;
    const secciones = resolvedCourse.secciones;
    const filtered = opts.seccion ? secciones.filter((s) => s.seccion === opts.seccion) : secciones;

    const allPages = await pMap(
      filtered,
      async (s) => {
        const pages = await fetchPages(Number(s.id));
        if (!opts.full) {
          return pages.map((p) => ({ ...p, body: undefined, seccion: s.seccion }));
        }
        const withBody = await pMap(
          pages,
          async (p) => {
            const full = await fetchPage(Number(s.id), p.url);
            return { ...full, seccion: s.seccion };
          },
          2,
        );
        return withBody;
      },
      4,
    );

    const paginas = allPages.flat().map((p) => ({
      url: p.url,
      title: p.title,
      body: p.body ? htmlToText(p.body) : undefined,
      updated_at: p.updated_at,
      seccion: (p as { seccion?: SectionType }).seccion ?? "T",
    }));

    const cursoInfo = {
      code: resolvedCourse.code,
      alias: resolvedCourse.alias,
      name: resolvedCourse.name,
    };
    const data = { curso: cursoInfo, paginas };

    if (opts.json) {
      emit(ok(data));
      return;
    }

    if (paginas.length === 0) {
      console.log(pc.dim(`No hay páginas en ${resolvedCourse.code}.`));
      return;
    }

    const baseColumns = [
      {
        header: "Secc.",
        get: (p: (typeof paginas)[number]) => p.seccion,
        fixed: 6,
        show: "wide" as const,
        priority: 4,
      },
      {
        header: "Título",
        get: (p: (typeof paginas)[number]) => p.title,
        weight: 2,
        min: 20,
        show: "always" as const,
        priority: 9,
      },
      {
        header: "URL",
        get: (p: (typeof paginas)[number]) => p.url,
        weight: 1,
        min: 12,
        max: 30,
        show: "wide" as const,
        priority: 3,
      },
      {
        header: "Actualizado",
        get: (p: (typeof paginas)[number]) => formatDueDate(p.updated_at),
        weight: 1,
        min: 14,
        show: "always" as const,
        priority: 8,
      },
    ];

    const columns = opts.full
      ? [
          ...baseColumns,
          {
            header: "Cuerpo",
            get: (p: (typeof paginas)[number]) => (p.body ? `${p.body.slice(0, 100)}…` : "—"),
            weight: 3,
            min: 20,
            show: "always" as const,
            priority: 7,
          },
        ]
      : baseColumns;

    console.log(renderSection(`Páginas — ${resolvedCourse.code}`, renderTable(paginas, columns)));
  } catch (e) {
    if (opts.json) {
      emit(toErrorEnvelope(e));
      return;
    }
    process.stderr.write(`Error: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
  }
}
