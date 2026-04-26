// wiener calificaciones <ref> — detailed submissions for one logical course

import pc from "picocolors";
import { fetchActiveCourses } from "../../lib/api/canvas/courses.js";
import { fetchCourseSubmissions } from "../../lib/api/canvas/submissions.js";
import { groupBySection } from "../../lib/courses/grouping.js";
import { resolveCourse } from "../../lib/courses/resolver.js";
import { toErrorEnvelope } from "../../lib/errors.js";
import { err, ok } from "../../lib/output/envelope.js";
import { renderSection } from "../../lib/output/human.js";
import { renderTable } from "../../lib/output/responsive-table.js";
import { formatDueDate } from "../../lib/format/date.js";
import { emit } from "../../lib/output/json.js";
import { pMap } from "../../lib/parallel.js";
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

export async function runCalificacionesDetail(
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

    const allSubmissions = await pMap(
      filtered,
      async (s) => {
        const subs = await fetchCourseSubmissions(s.id);
        return subs.map((sub) => ({
          seccion: s.seccion,
          assignment_id: sub.assignment_id,
          assignment_name: sub.assignment?.name ?? `Assignment ${sub.assignment_id}`,
          due_at: sub.assignment?.due_at ?? null,
          score: sub.score ?? null,
          grade: sub.grade ?? null,
          posted_at: sub.graded_at ?? null,
          state: sub.workflow_state,
          late: sub.late,
          missing: sub.missing,
          comments: sub.submission_comments?.map((c) => c.comment) ?? [],
        }));
      },
      4,
    );

    const submissions = allSubmissions
      .flat()
      .sort((a, b) => (a.due_at ?? "").localeCompare(b.due_at ?? ""));
    const cursoInfo = {
      code: resolvedCourse.code,
      alias: resolvedCourse.alias,
      name: resolvedCourse.name,
    };
    const data = { curso: cursoInfo, submissions };

    if (opts.json) {
      emit(ok(data));
      return;
    }

    if (submissions.length === 0) {
      console.log(pc.dim(`No hay submissions en ${resolvedCourse.code}.`));
      return;
    }

    function gradeColorStr(grade: string | null): string {
      if (!grade || grade === "—") return "—";
      const n = Number.parseFloat(grade);
      if (Number.isNaN(n)) return grade;
      if (n >= 14) return pc.green(grade);
      if (n >= 11) return pc.yellow(grade);
      return pc.red(pc.bold(grade));
    }

    console.log(
      renderSection(
        `Calificaciones — ${resolvedCourse.code}`,
        renderTable(submissions, [
          {
            header: "Secc.",
            get: (s) => s.seccion,
            fixed: 6,
            show: "wide",
            priority: 4,
          },
          {
            header: "Tarea",
            get: (s) => s.assignment_name,
            weight: 3,
            min: 20,
            show: "always",
            priority: 9,
          },
          {
            header: "Vence",
            get: (s) => formatDueDate(s.due_at),
            weight: 1,
            min: 14,
            show: "always",
            priority: 8,
          },
          {
            header: "Nota",
            get: (s) => s.grade ?? (s.score !== null ? String(s.score) : "—"),
            fixed: 6,
            color: (v) => gradeColorStr(v === "—" ? null : v),
            show: "always",
            priority: 7,
          },
          {
            header: "Estado",
            get: (s) =>
              s.state === "graded" ? "cal." : s.state === "submitted" ? "ent." : "pend.",
            fixed: 6,
            color: (v) =>
              v === "cal." ? pc.green(v) : v === "ent." ? pc.yellow(v) : pc.red(v),
            show: "always",
            priority: 6,
          },
          {
            header: "Tarde",
            get: (s) => (s.late ? "sí" : "no"),
            fixed: 5,
            color: (v) => (v === "sí" ? pc.red(v) : pc.dim(v)),
            show: "wide",
            priority: 3,
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
