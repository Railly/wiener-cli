// wiener calificaciones — cross-course grade overview via Canvas enrollments

import { fetchStudentEnrollments } from "../../lib/api/canvas/enrollments.js";
import { fetchActiveCourses } from "../../lib/api/canvas/courses.js";
import { ok } from "../../lib/output/envelope.js";
import { emit } from "../../lib/output/json.js";
import { renderTable, renderSection } from "../../lib/output/human.js";
import { toErrorEnvelope } from "../../lib/errors.js";
import pc from "picocolors";

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

    if (opts.json) { emit(ok(data)); return; }

    if (cursos.length === 0) {
      console.log(pc.dim("No hay cursos con calificaciones."));
      return;
    }

    function gradeColor(grade: string | null): string {
      if (!grade) return pc.dim("—");
      const n = parseFloat(grade);
      if (Number.isNaN(n)) return grade;
      if (n >= 14) return pc.green(grade);
      if (n >= 11) return pc.yellow(grade);
      return pc.red(grade);
    }

    const rows = cursos.map((c) => ({
      codigo: c.code,
      nombre: c.name,
      nota_actual: gradeColor(c.current_grade ?? (c.current_score !== null ? String(c.current_score) : null)),
      puntaje: c.current_score !== null ? String(c.current_score.toFixed(1)) : pc.dim("—"),
      nota_final: gradeColor(c.final_grade ?? (c.final_score !== null ? String(c.final_score) : null)),
    }));

    console.log(renderSection("Calificaciones", renderTable(rows, [
      { header: "Código", key: "codigo" },
      { header: "Nombre", key: "nombre", maxWidth: 40 },
      { header: "Nota actual", key: "nota_actual" },
      { header: "Puntaje", key: "puntaje" },
      { header: "Nota final", key: "nota_final" },
    ])));
  } catch (e) {
    if (opts.json) { emit(toErrorEnvelope(e)); return; }
    process.stderr.write(`Error: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
  }
}
