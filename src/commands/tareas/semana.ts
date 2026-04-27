// wiener tareas semana — due in next 7 days

import pc from "picocolors";
import { fetchAssignments } from "../../lib/api/canvas/assignments.js";
import { fetchActiveCourses } from "../../lib/api/canvas/courses.js";
import { getSubmissionStatus } from "../../lib/canvas/submission-status.js";
import { groupBySection } from "../../lib/courses/grouping.js";
import { toErrorEnvelope } from "../../lib/errors.js";
import { formatDueDate } from "../../lib/format/date.js";
import { ok } from "../../lib/output/envelope.js";
import { renderSection } from "../../lib/output/human.js";
import { emit } from "../../lib/output/json.js";
import { renderTable } from "../../lib/output/responsive-table.js";
import { pMap } from "../../lib/parallel.js";
import { isWithinDays } from "../../lib/time.js";

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

    const tareas = allTareas.flat().sort((a, b) => (a.due_at ?? "").localeCompare(b.due_at ?? ""));

    const data = { tareas, dias };

    if (opts.json) {
      emit(ok(data));
      return;
    }

    if (tareas.length === 0) {
      console.log(pc.green(`No hay tareas en los próximos ${dias} días.`));
      return;
    }

    console.log(
      renderSection(
        `Tareas — próximos ${dias} días`,
        renderTable(tareas, [
          {
            header: "Curso",
            get: (t) => t.curso,
            fixed: 12,
            color: (v) => pc.yellow(pc.bold(v)),
            show: "always",
            priority: 10,
          },
          {
            header: "Tarea",
            get: (t) => t.name,
            weight: 3,
            min: 20,
            show: "always",
            priority: 9,
          },
          {
            header: "Vence",
            get: (t) => formatDueDate(t.due_at),
            weight: 1,
            min: 14,
            show: "always",
            priority: 8,
          },
          {
            header: "Pts",
            get: (t) => (t.points > 0 ? String(t.points) : "—"),
            fixed: 4,
            align: "right",
            show: "wide",
            priority: 3,
          },
          {
            header: "Estado",
            get: (t) => (t.submitted ? "entregado" : "pendiente"),
            fixed: 11,
            color: (v) => (v === "entregado" ? pc.cyan(v) : pc.yellow(v)),
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
