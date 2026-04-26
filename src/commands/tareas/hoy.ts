// wiener tareas hoy — due today (America/Lima) + overdue

import pc from "picocolors";
import { fetchAssignments } from "../../lib/api/canvas/assignments.js";
import { fetchActiveCourses } from "../../lib/api/canvas/courses.js";
import { getSubmissionStatus } from "../../lib/canvas/submission-status.js";
import { groupBySection } from "../../lib/courses/grouping.js";
import { toErrorEnvelope } from "../../lib/errors.js";
import { ok } from "../../lib/output/envelope.js";
import { renderSection } from "../../lib/output/human.js";
import { renderTable } from "../../lib/output/responsive-table.js";
import { formatDueDate } from "../../lib/format/date.js";
import { emit } from "../../lib/output/json.js";
import { pMap } from "../../lib/parallel.js";
import { isPast, isToday } from "../../lib/time.js";

export async function runTareasHoy(opts: { json?: boolean; fields?: string }): Promise<void> {
  try {
    const canvasCourses = await fetchActiveCourses();
    const logicalCourses = groupBySection(canvasCourses);

    const allAssignments = await pMap(
      logicalCourses,
      async (lc) => {
        const results = await pMap(
          lc.secciones,
          async (s) => {
            const assignments = await fetchAssignments(Number(s.id));
            return assignments.map((a) => {
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

    const all = allAssignments.flat();
    const atrasadas = all.filter((a) => isPast(a.due_at));
    const hoy = all.filter((a) => isToday(a.due_at));

    const data = { atrasadas, hoy };

    if (opts.json) {
      emit(ok(data));
      return;
    }

    if (atrasadas.length === 0 && hoy.length === 0) {
      console.log(pc.green("No hay tareas vencidas ni para hoy."));
      return;
    }

    if (atrasadas.length > 0) {
      console.log(
        renderSection(
          "Atrasadas",
          renderTable(atrasadas, [
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
              header: "Venció",
              get: (t) => formatDueDate(t.due_at),
              weight: 1,
              min: 14,
              show: "always",
              priority: 8,
            },
            {
              header: "Estado",
              get: (t) => (t.submitted ? "entregado tarde" : "ATRASADA"),
              fixed: 14,
              color: (v) => (v === "entregado tarde" ? pc.yellow(v) : pc.red(pc.bold(v))),
              show: "always",
              priority: 7,
            },
          ]),
        ),
      );
    }

    if (hoy.length > 0) {
      console.log(
        renderSection(
          "Hoy",
          renderTable(hoy, [
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
    }
  } catch (e) {
    if (opts.json) {
      emit(toErrorEnvelope(e));
      return;
    }
    process.stderr.write(`Error: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
  }
}
