// wiener discusiones <ref>

import pc from "picocolors";
import { fetchActiveCourses } from "../lib/api/canvas/courses.js";
import { fetchDiscussions } from "../lib/api/canvas/discussion-topics.js";
import { groupBySection } from "../lib/courses/grouping.js";
import { resolveCourse } from "../lib/courses/resolver.js";
import { toErrorEnvelope } from "../lib/errors.js";
import { err, ok } from "../lib/output/envelope.js";
import { renderSection, truncateHtml } from "../lib/output/human.js";
import { renderTable } from "../lib/output/responsive-table.js";
import { formatDueDate } from "../lib/format/date.js";
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

export async function runDiscusiones(
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
      4,
    );

    const discusiones = allDiscusiones
      .flat()
      .sort((a, b) => b.posted_at.localeCompare(a.posted_at));
    const cursoInfo = {
      code: resolvedCourse.code,
      alias: resolvedCourse.alias,
      name: resolvedCourse.name,
    };
    const data = { curso: cursoInfo, discusiones };

    if (opts.json) {
      emit(ok(data));
      return;
    }

    if (discusiones.length === 0) {
      console.log(pc.dim(`No hay discusiones en ${resolvedCourse.code}.`));
      return;
    }

    console.log(
      renderSection(
        `Discusiones — ${resolvedCourse.code}`,
        renderTable(discusiones, [
          {
            header: "Secc.",
            get: (d) => d.seccion,
            fixed: 6,
            show: "wide",
            priority: 4,
          },
          {
            header: "Título",
            get: (d) => d.title,
            weight: 2,
            min: 20,
            show: "always",
            priority: 9,
          },
          {
            header: "Autor",
            get: (d) => d.author,
            weight: 1,
            min: 12,
            max: 25,
            show: "wide",
            priority: 5,
          },
          {
            header: "Fecha",
            get: (d) => formatDueDate(d.posted_at),
            weight: 1,
            min: 14,
            show: "wide",
            priority: 6,
          },
          {
            header: "Resp.",
            get: (d) => String(d.reply_count),
            fixed: 6,
            align: "right",
            show: "wide",
            priority: 3,
          },
          {
            header: "No leídas",
            get: (d) => String(d.unread_count),
            fixed: 9,
            color: (v) => (Number(v) > 0 ? pc.yellow(v) : pc.dim(v)),
            show: "wide",
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
