// wiener calificaciones — cross-course grade overview via Canvas enrollments

import pc from "picocolors";
import { fetchActiveCourses } from "../../lib/api/canvas/courses.js";
import { fetchStudentEnrollments } from "../../lib/api/canvas/enrollments.js";
import { toErrorEnvelope } from "../../lib/errors.js";
import { ok } from "../../lib/output/envelope.js";
import { renderSection } from "../../lib/output/human.js";
import { emit } from "../../lib/output/json.js";
import { renderTable } from "../../lib/output/responsive-table.js";

export async function runCalificaciones(opts: { json?: boolean; fields?: string }): Promise<void> {
  try {
    const [enrollments, courses] = await Promise.all([
      fetchStudentEnrollments(),
      fetchActiveCourses(),
    ]);

    const courseMap = new Map(courses.map((c) => [c.id, c]));

    const cursos = enrollments
      .filter((e) => e.type === "StudentEnrollment")
      .map((e) => {
        const course = courseMap.get(e.course_id);
        const grades = e.grades ?? {};
        return {
          code: course?.course_code ?? String(e.course_id),
          alias: course?.course_code?.toLowerCase() ?? String(e.course_id),
          name: course?.name ?? `Course ${e.course_id}`,
          current_grade: grades.current_grade ?? null,
          current_score: grades.current_score ?? null,
          final_grade: grades.final_grade ?? null,
          final_score: grades.final_score ?? null,
        };
      })
      .sort((a, b) => a.code.localeCompare(b.code));

    const data = { cursos };

    if (opts.json) {
      emit(ok(data));
      return;
    }

    if (cursos.length === 0) {
      console.log(pc.dim("No hay cursos con calificaciones."));
      return;
    }

    function gradeColorStr(grade: string | null): string {
      if (!grade) return "—";
      const n = Number.parseFloat(grade);
      if (Number.isNaN(n)) return grade;
      if (n >= 14) return pc.green(grade);
      if (n >= 11) return pc.yellow(grade);
      return pc.red(pc.bold(grade));
    }

    console.log(
      renderSection(
        "Calificaciones",
        renderTable(cursos, [
          {
            header: "Código",
            get: (c) => c.code,
            fixed: 12,
            show: "always",
            priority: 10,
          },
          {
            header: "Nombre",
            get: (c) => c.name,
            weight: 3,
            min: 20,
            show: "always",
            priority: 9,
          },
          {
            header: "Nota actual",
            get: (c) =>
              c.current_grade ?? (c.current_score !== null ? String(c.current_score) : "—"),
            fixed: 11,
            color: (v) => gradeColorStr(v === "—" ? null : v),
            show: "always",
            priority: 8,
          },
          {
            header: "Puntaje",
            get: (c) => (c.current_score !== null ? c.current_score.toFixed(1) : "—"),
            fixed: 7,
            align: "right",
            show: "wide",
            priority: 4,
          },
          {
            header: "Nota final",
            get: (c) => c.final_grade ?? (c.final_score !== null ? String(c.final_score) : "—"),
            fixed: 10,
            color: (v) => gradeColorStr(v === "—" ? null : v),
            show: "wide",
            priority: 6,
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
