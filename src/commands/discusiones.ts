// wiener discusiones <ref>

import { fetchDiscussions } from "../lib/api/canvas/discussion-topics.js";
import { fetchActiveCourses } from "../lib/api/canvas/courses.js";
import { resolveCourse } from "../lib/courses/resolver.js";
import { groupBySection } from "../lib/courses/grouping.js";
import { pMap } from "../lib/parallel.js";
import { ok, err } from "../lib/output/envelope.js";
import { emit } from "../lib/output/json.js";
import { renderTable, renderSection, formatDate, truncateHtml } from "../lib/output/human.js";
import { toErrorEnvelope } from "../lib/errors.js";
import type { CanvasCourse } from "../types/canvas.js";
import type { Course, SectionType } from "../types/course.js";
import pc from "picocolors";

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

export async function runDiscusiones(
  ref: string,
  opts: {
    json?: boolean;
    full?: boolean;
    seccion?: SectionType;
    exact?: boolean;
    noInput?: boolean;
  }
): Promise<void> {
  try {
    const canvasCourses = await fetchActiveCourses();
    const courses = toList(canvasCourses);
    const resolution = resolveCourse(ref, courses, { exact: opts.exact, noInput: opts.noInput });

    if (resolution.kind === "no-match" || resolution.kind === "ambiguous") {
      const errEnv = err("course-not-found", `No course matching "${ref}"`);
      if (opts.json) { emit(errEnv); return; }
      process.stderr.write(`No course matching "${ref}"\n`);
      process.exit(1);
      return;
    }

    const resolvedCourse = resolution.kind === "exact" ? resolution.course : resolution.course;
    const logical = groupBySection(courses);
    const logicalCourse = logical.find((lc) => lc.code === resolvedCourse.code);

    const secciones = logicalCourse?.secciones ?? [{ id: resolvedCourse.id, canvasName: resolvedCourse.canvasName, seccion: "T" as SectionType }];
    const filtered = opts.seccion ? secciones.filter((s) => s.seccion === opts.seccion) : secciones;

    const allDiscusiones = await pMap(
      filtered,
      async (s) => {
        const discussions = await fetchDiscussions(s.id);
        return discussions.map((d) => ({
          id: d.id,
          title: d.title,
          posted_at: d.posted_at,
          author: d.author.display_name,
          last_reply_at: d.last_reply_at ?? null,
          unread_count: d.unread_count,
          reply_count: d.discussion_subentry_count,
          message_html: opts.full ? d.message : truncateHtml(d.message, 200),
          url: d.html_url,
          seccion: s.seccion,
        }));
      },
      4
    );

    const discusiones = allDiscusiones.flat().sort((a, b) => b.posted_at.localeCompare(a.posted_at));
    const cursoInfo = { code: resolvedCourse.code, alias: resolvedCourse.alias, name: resolvedCourse.name };
    const data = { curso: cursoInfo, discusiones };

    if (opts.json) { emit(ok(data)); return; }

    if (discusiones.length === 0) {
      console.log(pc.dim(`No hay discusiones en ${resolvedCourse.code}.`));
      return;
    }

    const rows = discusiones.map((d) => ({
      secc: d.seccion,
      titulo: d.title,
      autor: d.author,
      fecha: formatDate(d.posted_at),
      respuestas: String(d.reply_count),
      no_leidas: d.unread_count > 0 ? pc.yellow(String(d.unread_count)) : pc.dim("0"),
    }));

    console.log(renderSection(`Discusiones — ${resolvedCourse.code}`, renderTable(rows, [
      { header: "Secc.", key: "secc" },
      { header: "Título", key: "titulo", maxWidth: 40 },
      { header: "Autor", key: "autor", maxWidth: 25 },
      { header: "Fecha", key: "fecha" },
      { header: "Resp.", key: "respuestas" },
      { header: "No leídas", key: "no_leidas" },
    ])));
  } catch (e) {
    if (opts.json) { emit(toErrorEnvelope(e)); return; }
    process.stderr.write(`Error: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
  }
}
