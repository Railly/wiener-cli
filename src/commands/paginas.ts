// wiener paginas <ref>

import pc from "picocolors";
import { fetchActiveCourses } from "../lib/api/canvas/courses.js";
import { fetchPage, fetchPages } from "../lib/api/canvas/pages.js";
import { groupBySection } from "../lib/courses/grouping.js";
import { resolveCourse } from "../lib/courses/resolver.js";
import { toErrorEnvelope } from "../lib/errors.js";
import { err, ok } from "../lib/output/envelope.js";
import { formatDate, htmlToText, renderSection, renderTable } from "../lib/output/human.js";
import { emit } from "../lib/output/json.js";
import { pMap } from "../lib/parallel.js";
import type { CanvasCourse } from "../types/canvas.js";
import type { Course, SectionType } from "../types/course.js";

function toList(canvasCourses: CanvasCourse[]): Course[] {
  return canvasCourses.map((c) => ({
    id: c.id,
    code: c.course_code,
    name: c.name,
    alias: c.course_code.toLowerCase(),
    canvasName: c.name,
    term: c.term?.name,
    role: c.enrollments?.[0]?.role ?? "StudentEnrollment",
    calendarIcsUrl: c.calendar?.ics,
  }));
}

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
    const courses = toList(canvasCourses);
    const resolution = resolveCourse(ref, courses, { exact: opts.exact, noInput: opts.noInput });

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

    const resolvedCourse = resolution.kind === "exact" ? resolution.course : resolution.course;
    const logical = groupBySection(courses);
    const logicalCourse = logical.find((lc) => lc.code === resolvedCourse.code);

    const secciones = logicalCourse?.secciones ?? [
      { id: resolvedCourse.id, canvasName: resolvedCourse.canvasName, seccion: "T" as SectionType },
    ];
    const filtered = opts.seccion ? secciones.filter((s) => s.seccion === opts.seccion) : secciones;

    const allPages = await pMap(
      filtered,
      async (s) => {
        const pages = await fetchPages(s.id);
        if (!opts.full) {
          return pages.map((p) => ({ ...p, body: undefined, seccion: s.seccion }));
        }
        const withBody = await pMap(
          pages,
          async (p) => {
            const full = await fetchPage(s.id, p.url);
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

    const rows = paginas.map((p) => ({
      secc: p.seccion,
      titulo: p.title,
      url: p.url,
      actualizado: formatDate(p.updated_at),
      ...(opts.full && p.body ? { cuerpo: `${p.body.slice(0, 100)}…` } : {}),
    }));

    const columns = [
      { header: "Secc.", key: "secc" },
      { header: "Título", key: "titulo", maxWidth: 45 },
      { header: "URL", key: "url", maxWidth: 30 },
      { header: "Actualizado", key: "actualizado" },
      ...(opts.full ? [{ header: "Cuerpo", key: "cuerpo", maxWidth: 80 }] : []),
    ];

    console.log(renderSection(`Páginas — ${resolvedCourse.code}`, renderTable(rows, columns)));
  } catch (e) {
    if (opts.json) {
      emit(toErrorEnvelope(e));
      return;
    }
    process.stderr.write(`Error: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
  }
}
