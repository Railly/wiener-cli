// wiener quizzes <ref>

import { fetchQuizzes } from "../lib/api/canvas/quizzes.js";
import { fetchActiveCourses } from "../lib/api/canvas/courses.js";
import { resolveCourse } from "../lib/courses/resolver.js";
import { groupBySection } from "../lib/courses/grouping.js";
import { pMap } from "../lib/parallel.js";
import { ok, err } from "../lib/output/envelope.js";
import { emit } from "../lib/output/json.js";
import { renderTable, renderSection, formatDate } from "../lib/output/human.js";
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

export async function runQuizzes(
  ref: string,
  opts: {
    json?: boolean;
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

    const allQuizzes = await pMap(
      filtered,
      async (s) => {
        const quizzes = await fetchQuizzes(s.id);
        return quizzes.map((q) => ({
          id: q.id,
          title: q.title,
          due_at: q.due_at ?? null,
          time_limit: q.time_limit ?? null,
          allowed_attempts: q.allowed_attempts,
          status: q.workflow_state,
          points_possible: q.points_possible ?? null,
          quiz_type: q.quiz_type,
          seccion: s.seccion,
          url: q.html_url,
        }));
      },
      4
    );

    const quizzes = allQuizzes.flat().sort((a, b) => (a.due_at ?? "").localeCompare(b.due_at ?? ""));
    const cursoInfo = { code: resolvedCourse.code, alias: resolvedCourse.alias, name: resolvedCourse.name };
    const data = { curso: cursoInfo, quizzes };

    if (opts.json) { emit(ok(data)); return; }

    if (quizzes.length === 0) {
      console.log(pc.dim(`No hay quizzes en ${resolvedCourse.code}.`));
      return;
    }

    const rows = quizzes.map((q) => ({
      secc: q.seccion,
      titulo: q.title,
      vencimiento: formatDate(q.due_at),
      tiempo: q.time_limit ? `${q.time_limit} min` : pc.dim("—"),
      intentos: q.allowed_attempts === -1 ? "∞" : String(q.allowed_attempts),
      puntos: q.points_possible !== null ? String(q.points_possible) : pc.dim("—"),
      estado: q.status === "published" ? pc.green("publicado") : pc.dim(q.status),
    }));

    console.log(renderSection(`Quizzes — ${resolvedCourse.code}`, renderTable(rows, [
      { header: "Secc.", key: "secc" },
      { header: "Título", key: "titulo", maxWidth: 40 },
      { header: "Vencimiento", key: "vencimiento" },
      { header: "Tiempo", key: "tiempo" },
      { header: "Intentos", key: "intentos" },
      { header: "Pts", key: "puntos" },
      { header: "Estado", key: "estado" },
    ])));
  } catch (e) {
    if (opts.json) { emit(toErrorEnvelope(e)); return; }
    process.stderr.write(`Error: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
  }
}
