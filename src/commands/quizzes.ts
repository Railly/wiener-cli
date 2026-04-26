// wiener quizzes <ref>

import pc from "picocolors";
import { fetchActiveCourses } from "../lib/api/canvas/courses.js";
import { fetchQuizzes } from "../lib/api/canvas/quizzes.js";
import { groupBySection } from "../lib/courses/grouping.js";
import { resolveCourse } from "../lib/courses/resolver.js";
import { toErrorEnvelope } from "../lib/errors.js";
import { err, ok } from "../lib/output/envelope.js";
import { renderSection } from "../lib/output/human.js";
import { renderTable } from "../lib/output/responsive-table.js";
import { formatDueDate } from "../lib/format/date.js";
import { emit } from "../lib/output/json.js";
import { pMap } from "../lib/parallel.js";
import type { SectionType } from "../types/course.js";

export async function runQuizzes(
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

    const allQuizzes = await pMap(
      filtered,
      async (s) => {
        const quizzes = await fetchQuizzes(Number(s.id));
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
      4,
    );

    const quizzes = allQuizzes
      .flat()
      .sort((a, b) => (a.due_at ?? "").localeCompare(b.due_at ?? ""));
    const cursoInfo = {
      code: resolvedCourse.code,
      alias: resolvedCourse.alias,
      name: resolvedCourse.name,
    };
    const data = { curso: cursoInfo, quizzes };

    if (opts.json) {
      emit(ok(data));
      return;
    }

    if (quizzes.length === 0) {
      console.log(pc.dim(`No hay quizzes en ${resolvedCourse.code}.`));
      return;
    }

    console.log(
      renderSection(
        `Quizzes — ${resolvedCourse.code}`,
        renderTable(quizzes, [
          {
            header: "Secc.",
            get: (q) => q.seccion,
            fixed: 6,
            show: "wide",
            priority: 4,
          },
          {
            header: "Título",
            get: (q) => q.title,
            weight: 2,
            min: 20,
            show: "always",
            priority: 9,
          },
          {
            header: "Vence",
            get: (q) => formatDueDate(q.due_at),
            weight: 1,
            min: 14,
            show: "always",
            priority: 8,
          },
          {
            header: "Tiempo",
            get: (q) => (q.time_limit ? `${q.time_limit} min` : "—"),
            fixed: 8,
            show: "wide",
            priority: 5,
          },
          {
            header: "Intentos",
            get: (q) => (q.allowed_attempts === -1 ? "∞" : String(q.allowed_attempts)),
            fixed: 8,
            align: "right",
            show: "wide",
            priority: 3,
          },
          {
            header: "Pts",
            get: (q) => (q.points_possible !== null ? String(q.points_possible) : "—"),
            fixed: 4,
            align: "right",
            show: "wide",
            priority: 6,
          },
          {
            header: "Estado",
            get: (q) => q.status,
            fixed: 10,
            color: (v) => (v === "published" ? pc.green("publicado") : pc.dim(v)),
            show: "always",
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
