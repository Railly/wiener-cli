// wiener conferencias <ref>

import pc from "picocolors";
import { fetchConferences } from "../lib/api/canvas/conferences.js";
import { fetchActiveCourses } from "../lib/api/canvas/courses.js";
import { groupBySection } from "../lib/courses/grouping.js";
import { resolveCourse } from "../lib/courses/resolver.js";
import { toErrorEnvelope } from "../lib/errors.js";
import { err, ok } from "../lib/output/envelope.js";
import { renderSection } from "../lib/output/human.js";
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

export async function runConferencias(
  ref: string,
  opts: {
    json?: boolean;
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

    const allConferencias = await pMap(
      filtered,
      async (s) => {
        const confs = await fetchConferences(s.id);
        return confs.map((c) => ({
          id: c.id,
          title: c.title,
          type: c.conference_type,
          started_at: c.started_at ?? null,
          ended_at: c.ended_at ?? null,
          recordings: (c.recordings ?? []).map((r) => ({
            url: r.playback_url,
            created_at: r.created_at,
          })),
          seccion: s.seccion,
        }));
      },
      4,
    );

    const conferencias = allConferencias
      .flat()
      .sort((a, b) => (b.started_at ?? "").localeCompare(a.started_at ?? ""));
    const cursoInfo = {
      code: resolvedCourse.code,
      alias: resolvedCourse.alias,
      name: resolvedCourse.name,
    };
    const data = { curso: cursoInfo, conferencias };

    if (opts.json) {
      emit(ok(data));
      return;
    }

    if (conferencias.length === 0) {
      console.log(pc.dim(`No hay conferencias en ${resolvedCourse.code}.`));
      return;
    }

    console.log(
      renderSection(
        `Conferencias — ${resolvedCourse.code}`,
        renderTable(conferencias, [
          {
            header: "Secc.",
            get: (c) => c.seccion,
            fixed: 6,
            show: "wide",
            priority: 4,
          },
          {
            header: "Título",
            get: (c) => c.title,
            weight: 2,
            min: 20,
            show: "always",
            priority: 9,
          },
          {
            header: "Tipo",
            get: (c) => c.type,
            fixed: 10,
            show: "wide",
            priority: 3,
          },
          {
            header: "Inicio",
            get: (c) => formatDueDate(c.started_at),
            weight: 1,
            min: 14,
            show: "always",
            priority: 8,
          },
          {
            header: "Fin",
            get: (c) => formatDueDate(c.ended_at),
            weight: 1,
            min: 14,
            show: "wide",
            priority: 6,
          },
          {
            header: "Grabs.",
            get: (c) => String(c.recordings.length),
            fixed: 6,
            align: "right",
            color: (v) => (Number(v) > 0 ? pc.green(v) : pc.dim(v)),
            show: "wide",
            priority: 5,
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
