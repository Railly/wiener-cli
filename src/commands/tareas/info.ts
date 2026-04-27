// wiener tareas info <assignment-id>
// Requires course_id — assignment IDs are not globally unique in Canvas.
// Usage: wiener tareas info <assignment_id> --curso <course_ref>

import pc from "picocolors";
import { fetchAssignment } from "../../lib/api/canvas/assignments.js";
import { fetchActiveCourses } from "../../lib/api/canvas/courses.js";
import { groupBySection } from "../../lib/courses/grouping.js";
import { resolveCourse } from "../../lib/courses/resolver.js";
import { toErrorEnvelope } from "../../lib/errors.js";
import { err, ok } from "../../lib/output/envelope.js";
import { formatDate, htmlToText, renderKeyValue, renderSection } from "../../lib/output/human.js";
import { emit } from "../../lib/output/json.js";

export async function runTareasInfo(
  assignmentId: string,
  opts: {
    json?: boolean;
    curso?: string;
    exact?: boolean;
    noInput?: boolean;
  },
): Promise<void> {
  try {
    if (!opts.curso) {
      const e = err(
        "validation-error",
        "Assignment info requires --curso <ref>",
        "Example: wiener tareas info 12345 --curso farma",
      );
      if (opts.json) {
        emit(e);
        return;
      }
      process.stderr.write("Error: --curso <ref> is required for tareas info\n");
      process.exit(1);
      return;
    }

    const canvasCourses = await fetchActiveCourses();
    const logical = groupBySection(canvasCourses);
    const resolution = resolveCourse(opts.curso, logical, {
      exact: opts.exact,
      noInput: opts.noInput,
    });

    if (resolution.kind === "no-match" || resolution.kind === "ambiguous") {
      const errEnv = err("course-not-found", `No course matching "${opts.curso}"`);
      if (opts.json) {
        emit(errEnv);
        return;
      }
      process.stderr.write(`No course matching "${opts.curso}"\n`);
      process.exit(1);
      return;
    }

    const course = resolution.course;
    const primarySection = course.secciones[0];
    const aid = Number.parseInt(assignmentId, 10);
    if (Number.isNaN(aid)) {
      const e = err("validation-error", "Assignment ID must be a number");
      if (opts.json) {
        emit(e);
        return;
      }
      process.stderr.write("Error: assignment ID must be a number\n");
      process.exit(1);
      return;
    }

    const assignment = await fetchAssignment(
      Number(primarySection?.id ?? course.secciones[0]?.id),
      aid,
    );
    const sub = assignment.submission;

    const data = {
      id: assignment.id,
      name: assignment.name,
      description: assignment.description ? htmlToText(assignment.description) : null,
      due_at: assignment.due_at ?? null,
      points: assignment.points_possible,
      submission_types: assignment.submission_types,
      rubric: assignment.rubric ?? null,
      submission: sub
        ? {
            submitted_at: sub.submitted_at ?? null,
            graded_at: sub.graded_at ?? null,
            score: sub.score ?? null,
            grade: sub.grade ?? null,
            state: sub.workflow_state,
            late: sub.late,
            missing: sub.missing,
            comments:
              sub.submission_comments?.map((c) => ({
                author: c.author_name,
                body: c.comment,
                at: c.created_at,
              })) ?? [],
          }
        : null,
      url: assignment.html_url,
    };

    if (opts.json) {
      emit(ok(data));
      return;
    }

    console.log(
      renderSection(
        `Tarea #${assignment.id} — ${assignment.name}`,
        renderKeyValue({
          Curso: `${course.code} (${course.name ?? ""})`,
          Vencimiento: formatDate(assignment.due_at),
          Puntos: String(assignment.points_possible),
          Tipos: assignment.submission_types.join(", "),
          URL: assignment.html_url,
        }),
      ),
    );

    if (data.description) {
      console.log(renderSection("Descripción", data.description.slice(0, 1000)));
    }

    if (data.submission) {
      const s = data.submission;
      const stateColor =
        s.state === "graded" ? pc.green : s.state === "submitted" ? pc.yellow : pc.red;
      console.log(
        renderSection(
          "Tu entrega",
          renderKeyValue({
            Estado: stateColor(s.state),
            Entregado: formatDate(s.submitted_at),
            Calificado: formatDate(s.graded_at),
            Nota: s.grade ?? pc.dim("—"),
            Puntaje: s.score !== null ? String(s.score) : pc.dim("—"),
            Atrasado: s.late ? pc.red("Sí") : "No",
            Faltante: s.missing ? pc.red("Sí") : "No",
          }),
        ),
      );

      if (s.comments.length > 0) {
        const commentsText = s.comments.map((c) => `${pc.bold(c.author)}: ${c.body}`).join("\n");
        console.log(renderSection("Comentarios", commentsText));
      }
    } else {
      console.log(pc.dim("\nNo hay entrega registrada."));
    }

    if (assignment.rubric && assignment.rubric.length > 0) {
      const rubricRows = assignment.rubric.map((r) => ({
        criterio: r.description,
        puntos: String(r.points),
      }));
      console.log(
        renderSection(
          "Rubrica",
          rubricRows.map((r) => `  ${r.puntos} pts — ${r.criterio}`).join("\n"),
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
