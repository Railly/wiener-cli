// wiener anuncios <ref> — announcements for one logical course

import pc from "picocolors";
import { fetchAnnouncements } from "../../lib/api/canvas/announcements.js";
import { fetchActiveCourses } from "../../lib/api/canvas/courses.js";
import { groupBySection } from "../../lib/courses/grouping.js";
import { resolveCourse } from "../../lib/courses/resolver.js";
import { toErrorEnvelope } from "../../lib/errors.js";
import { err, ok } from "../../lib/output/envelope.js";
import { formatDate, renderSection, renderTable, truncateHtml } from "../../lib/output/human.js";
import { emit } from "../../lib/output/json.js";
import { emitStream } from "../../lib/output/ndjson.js";
import type { CanvasCourse } from "../../types/canvas.js";
import type { Course, SectionType } from "../../types/course.js";

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

export async function runAnunciosByCourse(
  ref: string,
  opts: {
    json?: boolean;
    ndjson?: boolean;
    full?: boolean;
    ultimos?: number;
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
    const courseIds = filtered.map((s) => s.id);

    const n = opts.ultimos ?? 20;
    const rawAnuncios = await fetchAnnouncements(courseIds, n);

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

    const cursoInfo = {
      code: resolvedCourse.code,
      alias: resolvedCourse.alias,
      name: resolvedCourse.name,
    };
    const data = { curso: cursoInfo, anuncios };

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
      console.log(pc.dim(`No hay anuncios en ${resolvedCourse.code}.`));
      return;
    }

    const rows = anuncios.map((a) => ({
      titulo: a.title,
      fecha: formatDate(a.posted_at),
      autor: a.author,
      ...(opts.full ? { cuerpo: a.body } : {}),
    }));

    const columns = [
      { header: "Título", key: "titulo", maxWidth: 45 },
      { header: "Fecha", key: "fecha" },
      { header: "Autor", key: "autor", maxWidth: 30 },
      ...(opts.full ? [{ header: "Mensaje", key: "cuerpo", maxWidth: 80 }] : []),
    ];

    console.log(renderSection(`Anuncios — ${resolvedCourse.code}`, renderTable(rows, columns)));
  } catch (e) {
    if (opts.json) {
      emit(toErrorEnvelope(e));
      return;
    }
    process.stderr.write(`Error: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
  }
}
