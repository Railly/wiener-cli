// wiener calificaciones <ref> — detailed submissions for one logical course

import pc from "picocolors";
import { fetchActiveCourses } from "../../lib/api/canvas/courses.js";
import { fetchCourseSubmissions } from "../../lib/api/canvas/submissions.js";
import { groupBySection } from "../../lib/courses/grouping.js";
import { resolveCourse } from "../../lib/courses/resolver.js";
import { toErrorEnvelope } from "../../lib/errors.js";
import { err, ok } from "../../lib/output/envelope.js";
import { formatDate, renderSection, renderTable } from "../../lib/output/human.js";
import { emit } from "../../lib/output/json.js";
import { pMap } from "../../lib/parallel.js";
import type { SectionType } from "../../types/course.js";

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

    const allSubmissions = await pMap(
      filtered,
      async (s) => {
        const subs = await fetchCourseSubmissions(Number(s.id));
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

    function gradeColor(grade: string | null): string {
      if (!grade) return pc.dim("—");
      const n = Number.parseFloat(grade);
      if (Number.isNaN(n)) return grade;
      if (n >= 14) return pc.green(grade);
      if (n >= 11) return pc.yellow(grade);
      return pc.red(grade);
    }

    const rows = submissions.map((s) => ({
      secc: s.seccion,
      nombre: s.assignment_name,
      vencimiento: formatDate(s.due_at),
      nota: gradeColor(s.grade ?? (s.score !== null ? String(s.score) : null)),
      estado:
        s.state === "graded"
          ? pc.green("cal.")
          : s.state === "submitted"
            ? pc.yellow("ent.")
            : pc.red("pend."),
      tarde: s.late ? pc.red("sí") : "no",
    }));

    console.log(
      renderSection(
        `Calificaciones — ${resolvedCourse.code}`,
        renderTable(rows, [
          { header: "Secc.", key: "secc" },
          { header: "Tarea", key: "nombre", maxWidth: 45 },
          { header: "Vencimiento", key: "vencimiento" },
          { header: "Nota", key: "nota" },
          { header: "Estado", key: "estado" },
          { header: "Tarde", key: "tarde" },
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
