// wiener quizzes <ref>

import pc from "picocolors";
import { fetchActiveCourses } from "../lib/api/canvas/courses.js";
import { fetchQuizzes } from "../lib/api/canvas/quizzes.js";
import { groupBySection } from "../lib/courses/grouping.js";
import { resolveCourse } from "../lib/courses/resolver.js";
import { toErrorEnvelope } from "../lib/errors.js";
import { err, ok } from "../lib/output/envelope.js";
import { formatDate, renderSection, renderTable } from "../lib/output/human.js";
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

    const rows = quizzes.map((q) => ({
      secc: q.seccion,
      titulo: q.title,
      vencimiento: formatDate(q.due_at),
      tiempo: q.time_limit ? `${q.time_limit} min` : pc.dim("—"),
      intentos: q.allowed_attempts === -1 ? "∞" : String(q.allowed_attempts),
      puntos: q.points_possible !== null ? String(q.points_possible) : pc.dim("—"),
      estado: q.status === "published" ? pc.green("publicado") : pc.dim(q.status),
    }));

    console.log(
      renderSection(
        `Quizzes — ${resolvedCourse.code}`,
        renderTable(rows, [
          { header: "Secc.", key: "secc" },
          { header: "Título", key: "titulo", maxWidth: 40 },
          { header: "Vencimiento", key: "vencimiento" },
          { header: "Tiempo", key: "tiempo" },
          { header: "Intentos", key: "intentos" },
          { header: "Pts", key: "puntos" },
          { header: "Estado", key: "estado" },
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
