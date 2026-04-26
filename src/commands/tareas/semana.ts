// wiener tareas semana — due in next 7 days

import pc from "picocolors";
import { fetchActiveCourses } from "../../lib/api/canvas/courses.js";
import { getSubmissionStatus } from "../../lib/canvas/submission-status.js";
import { groupBySection } from "../../lib/courses/grouping.js";
import { toErrorEnvelope } from "../../lib/errors.js";
import { ok } from "../../lib/output/envelope.js";
import { formatDate, renderSection, renderTable } from "../../lib/output/human.js";
import { emit } from "../../lib/output/json.js";
import { pMap } from "../../lib/parallel.js";
import { isWithinDays } from "../../lib/time.js";
import { fetchAssignments } from "../../lib/api/canvas/assignments.js";

export async function runTareasSemana(opts: { json?: boolean; dias?: number }): Promise<void> {
  try {
    const dias = opts.dias ?? 7;
    const canvasCourses = await fetchActiveCourses();
    const logicalCourses = groupBySection(canvasCourses);

    const allTareas = await pMap(
      logicalCourses,
      async (lc) => {
        const results = await pMap(
          lc.secciones,
          async (s) => {
            const assignments = await fetchAssignments(Number(s.id));
            return assignments
              .filter((a) => isWithinDays(a.due_at, dias))
              .map((a) => {
                const statusResult = getSubmissionStatus(a.submission);
                return {
                  id: a.id,
                  name: a.name,
                  due_at: a.due_at ?? null,
                  points: a.points_possible,
                  curso: `${lc.code}-${s.seccion}`,
                  url: a.html_url,
                  submitted: statusResult.submitted,
                  graded: statusResult.graded,
                  grade: statusResult.grade,
                  late: statusResult.late,
                  statusLabel: statusResult.label,
                };
              });
          },
          4,
        );
        return results.flat();
      },
      4,
    );

    const tareas = allTareas
      .flat()
      .sort((a, b) => (a.due_at ?? "").localeCompare(b.due_at ?? ""));

    const data = { tareas, dias };

    if (opts.json) {
      emit(ok(data));
      return;
    }

    if (tareas.length === 0) {
      console.log(pc.green(`No hay tareas en los próximos ${dias} días.`));
      return;
    }

    const rows = tareas.map((t) => ({
      id: String(t.id),
      curso: t.curso,
      nombre: t.name,
      vencimiento: formatDate(t.due_at),
      puntos: String(t.points),
      estado: t.graded
        ? pc.green(t.statusLabel)
        : t.submitted
          ? pc.yellow(t.statusLabel)
          : pc.red(t.statusLabel),
    }));

    console.log(
      renderSection(
        `Tareas — próximos ${dias} días`,
        renderTable(rows, [
          { header: "ID", key: "id" },
          { header: "Curso", key: "curso" },
          { header: "Nombre", key: "nombre", maxWidth: 45 },
          { header: "Vencimiento", key: "vencimiento" },
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
