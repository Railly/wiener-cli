// wiener tareas hoy — due today (America/Lima) + overdue

import pc from "picocolors";
import { fetchAssignments } from "../../lib/api/canvas/assignments.js";
import { fetchActiveCourses } from "../../lib/api/canvas/courses.js";
import { getSubmissionStatus } from "../../lib/canvas/submission-status.js";
import { groupBySection } from "../../lib/courses/grouping.js";
import { toErrorEnvelope } from "../../lib/errors.js";
import { ok } from "../../lib/output/envelope.js";
import { formatDate, renderSection, renderTable } from "../../lib/output/human.js";
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
      const rows = atrasadas.map((t) => ({
        id: String(t.id),
        curso: t.curso,
        nombre: t.name,
        vencio: formatDate(t.due_at),
        estado: t.submitted ? pc.yellow("entregado tarde") : pc.red("ATRASADA"),
      }));
      console.log(
        renderSection(
          "Atrasadas",
          renderTable(rows, [
            { header: "ID", key: "id" },
            { header: "Curso", key: "curso" },
            { header: "Nombre", key: "nombre", maxWidth: 40 },
            { header: "Venció", key: "vencio" },
            { header: "Estado", key: "estado" },
          ]),
        ),
      );
    }

    if (hoy.length > 0) {
      const rows = hoy.map((t) => ({
        id: String(t.id),
        curso: t.curso,
        nombre: t.name,
        vencimiento: formatDate(t.due_at),
        estado: t.graded
          ? pc.green(t.statusLabel)
          : t.submitted
            ? pc.yellow(t.statusLabel)
            : pc.red("pendiente"),
      }));
      console.log(
        renderSection(
          "Hoy",
          renderTable(rows, [
            { header: "ID", key: "id" },
            { header: "Curso", key: "curso" },
            { header: "Nombre", key: "nombre", maxWidth: 40 },
            { header: "Vencimiento", key: "vencimiento" },
            { header: "Estado", key: "estado" },
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
