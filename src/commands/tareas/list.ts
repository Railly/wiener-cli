// wiener tareas — all pending tasks across all active courses
// wiener tareas <ref> — tasks for a specific course

import pc from "picocolors";
import { fetchAssignments } from "../../lib/api/canvas/assignments.js";
import { fetchActiveCourses } from "../../lib/api/canvas/courses.js";
import { fetchTodoItems, fetchUpcomingEvents } from "../../lib/api/canvas/calendar.js";
import { getSubmissionStatus } from "../../lib/canvas/submission-status.js";
import { groupBySection } from "../../lib/courses/grouping.js";
import { resolveCourse } from "../../lib/courses/resolver.js";
import { toErrorEnvelope } from "../../lib/errors.js";
import { err, ok } from "../../lib/output/envelope.js";
import { projectFields } from "../../lib/output/fields.js";
import { formatDate, renderSection, renderTable } from "../../lib/output/human.js";
import { emit } from "../../lib/output/json.js";
import { pMap } from "../../lib/parallel.js";
import { isInteractive } from "../../lib/tty.js";
import type { SectionType } from "../../types/course.js";

interface TareaItem {
  id: number;
  curso: {
    code: string;
    alias: string;
    seccion: SectionType;
    courseId: number;
  };
  name: string;
  due_at: string | null;
  points: number;
  submitted: boolean;
  graded: boolean;
  grade: string | null;
  late: boolean;
  url: string;
}

function renderEstado(t: TareaItem): string {
  if (t.graded) {
    const grade = t.grade ? ` ${t.grade}` : "";
    const late = t.late ? pc.dim(" (tarde)") : "";
    return `${pc.green(`calificado${grade}`)}${late}`;
  }
  if (t.submitted) {
    return t.late ? pc.yellow("entregado (tarde)") : pc.yellow("entregado");
  }
  return pc.red("pendiente");
}

export async function runTareasList(opts: {
  json?: boolean;
  ndjson?: boolean;
  fields?: string;
  seccion?: SectionType;
}): Promise<void> {
  try {
    const [upcomingEvents, todoItems, canvasCourses] = await Promise.all([
      fetchUpcomingEvents(),
      fetchTodoItems(),
      fetchActiveCourses(),
    ]);

    const logicalCourses = groupBySection(canvasCourses);

    const courseIdToLabel = new Map<number, { code: string; seccion: string; alias: string }>();
    for (const lc of logicalCourses) {
      for (const s of lc.secciones) {
        courseIdToLabel.set(Number(s.id), {
          code: lc.code,
          seccion: s.seccion,
          alias: lc.alias,
        });
      }
    }

    const tareaMap = new Map<string, TareaItem>();

    for (const ev of upcomingEvents) {
      if (!ev.assignment) continue;
      const a = ev.assignment;
      const sub = a.submission;
      const key = `${a.course_id}-${a.id}`;
      if (tareaMap.has(key)) continue;

      const courseId = a.course_id;
      const label = courseIdToLabel.get(courseId);
      const statusResult = getSubmissionStatus(sub);

      tareaMap.set(key, {
        id: a.id,
        curso: {
          code: label?.code ?? String(courseId),
          alias: label?.alias ?? String(courseId),
          seccion: (label?.seccion ?? "T") as SectionType,
          courseId,
        },
        name: a.name,
        due_at: a.due_at ?? null,
        points: a.points_possible,
        submitted: statusResult.submitted,
        graded: statusResult.graded,
        grade: statusResult.grade,
        late: statusResult.late,
        url: a.html_url,
      });
    }

    for (const todo of todoItems) {
      if (!todo.assignment) continue;
      const a = todo.assignment;
      const sub = a.submission;
      const key = `${a.course_id}-${a.id}`;
      if (tareaMap.has(key)) continue;

      const courseId = a.course_id;
      const label = courseIdToLabel.get(courseId);
      const statusResult = getSubmissionStatus(sub);

      tareaMap.set(key, {
        id: a.id,
        curso: {
          code: label?.code ?? String(courseId),
          alias: label?.alias ?? String(courseId),
          seccion: (label?.seccion ?? "T") as SectionType,
          courseId,
        },
        name: a.name,
        due_at: a.due_at ?? null,
        points: a.points_possible,
        submitted: statusResult.submitted,
        graded: statusResult.graded,
        grade: statusResult.grade,
        late: statusResult.late,
        url: a.html_url,
      });
    }

    let tareas = Array.from(tareaMap.values()).sort((a, b) =>
      (a.due_at ?? "").localeCompare(b.due_at ?? ""),
    );

    if (opts.seccion) {
      tareas = tareas.filter((t) => t.curso.seccion === opts.seccion);
    }

    const data = { tareas };

    if (opts.json) {
      const envelope = ok(
        opts.fields ? projectFields(data as unknown as Record<string, unknown>, opts.fields) : data,
      );
      emit(envelope);
      return;
    }

    if (opts.ndjson) {
      for (const t of tareas) process.stdout.write(`${JSON.stringify(t)}\n`);
      return;
    }

    if (tareas.length === 0) {
      console.log(pc.green("No hay tareas pendientes."));
      return;
    }

    const rows = tareas.map((t) => ({
      id: String(t.id),
      curso: `${t.curso.code}-${t.curso.seccion}`,
      nombre: t.name,
      vencimiento: formatDate(t.due_at),
      puntos: String(t.points),
      estado: renderEstado(t),
      nota: t.grade ?? pc.dim("—"),
    }));

    console.log(
      renderSection(
        "Tareas pendientes",
        renderTable(rows, [
          { header: "ID", key: "id" },
          { header: "Curso", key: "curso" },
          { header: "Nombre", key: "nombre", maxWidth: 40 },
          { header: "Vencimiento", key: "vencimiento" },
          { header: "Pts", key: "puntos" },
          { header: "Estado", key: "estado" },
          { header: "Nota", key: "nota" },
        ]),
      ),
    );
  } catch (e) {
    if (opts.json) {
      emit(toErrorEnvelope(e));
    } else {
      process.stderr.write(`Error: ${e instanceof Error ? e.message : String(e)}\n`);
    }
    process.exit(1);
  }
}

export async function runTareasByCourse(
  ref: string,
  opts: {
    json?: boolean;
    ndjson?: boolean;
    fields?: string;
    seccion?: SectionType;
    exact?: boolean;
    noInput?: boolean;
  },
): Promise<void> {
  try {
    const canvasCourses = await fetchActiveCourses();
    const logicalCourses = groupBySection(canvasCourses);

    const resolution = resolveCourse(ref, logicalCourses, {
      exact: opts.exact,
      noInput: opts.noInput,
    });

    if (resolution.kind === "no-match") {
      const errEnv = err("course-not-found", `No course matching "${ref}"`, "Try: wiener cursos", {
        closest: resolution.closest.map((c) => ({
          code: c.course.code,
          name: c.course.name,
          score: c.score,
        })),
      });
      if (opts.json) {
        emit(errEnv);
        return;
      }
      process.stderr.write(`No course matching "${ref}"\n`);
      process.exit(1);
    }

    if (resolution.kind === "ambiguous") {
      if (!opts.json && isInteractive()) {
        const { select } = await import("@clack/prompts");
        const chosen = await select({
          message: `Múltiples cursos coinciden con "${ref}". ¿Cuál querés?`,
          options: resolution.candidates.map((c) => ({
            value: c.course,
            label: `${c.course.code} — ${c.course.name}`,
          })),
        });
        if (!chosen || typeof chosen === "symbol") {
          process.exit(0);
        }
        const resolvedCourse = chosen as (typeof logicalCourses)[number];
        return runTareasForLogical(resolvedCourse, opts);
      }

      const errEnv = err(
        "course-ambiguous",
        `Multiple courses match "${ref}"`,
        "Try: wiener cursos",
        {
          candidates: resolution.candidates.map((c) => ({
            code: c.course.code,
            name: c.course.name,
            score: c.score,
          })),
        },
      );
      if (opts.json) {
        emit(errEnv);
        return;
      }
      process.stderr.write(
        `Ambiguous: ${resolution.candidates.map((c) => c.course.code).join(", ")}\n`,
      );
      process.exit(1);
    }

    const resolvedCourse = resolution.course;
    return runTareasForLogical(resolvedCourse, opts);
  } catch (e) {
    if (opts.json) {
      emit(toErrorEnvelope(e));
    } else {
      process.stderr.write(`Error: ${e instanceof Error ? e.message : String(e)}\n`);
    }
    process.exit(1);
  }
}

async function runTareasForLogical(
  logicalCourse: import("../../types/course.js").LogicalCourse,
  opts: {
    json?: boolean;
    ndjson?: boolean;
    fields?: string;
    seccion?: SectionType;
  },
): Promise<void> {
  const secciones = logicalCourse.secciones;
  const filtered = opts.seccion ? secciones.filter((s) => s.seccion === opts.seccion) : secciones;

  const allTareas = await pMap(
    filtered,
    async (s) => {
      const assignments = await fetchAssignments(Number(s.id));
      return assignments.map((a) => {
        const statusResult = getSubmissionStatus(a.submission);
        return {
          id: a.id,
          curso: {
            code: logicalCourse.code,
            alias: logicalCourse.alias,
            seccion: s.seccion,
            courseId: Number(s.id),
          },
          name: a.name,
          due_at: a.due_at ?? null,
          points: a.points_possible,
          submitted: statusResult.submitted,
          graded: statusResult.graded,
          grade: statusResult.grade,
          late: statusResult.late,
          url: a.html_url,
        } satisfies TareaItem;
      });
    },
    4,
  );

  const tareas = allTareas.flat().sort((a, b) => (a.due_at ?? "").localeCompare(b.due_at ?? ""));
  const cursoInfo = {
    code: logicalCourse.code,
    alias: logicalCourse.alias,
    name: logicalCourse.name,
  };

  const data = { curso: cursoInfo, tareas };

  if (opts.json) {
    const envelope = ok(
      opts.fields ? projectFields(data as unknown as Record<string, unknown>, opts.fields) : data,
    );
    emit(envelope);
    return;
  }

  if (opts.ndjson) {
    for (const t of tareas) process.stdout.write(`${JSON.stringify(t)}\n`);
    return;
  }

  if (tareas.length === 0) {
    console.log(pc.green(`No hay tareas en ${logicalCourse.code}.`));
    return;
  }

  const rows = tareas.map((t) => ({
    id: String(t.id),
    seccion: t.curso.seccion,
    nombre: t.name,
    vencimiento: formatDate(t.due_at),
    puntos: String(t.points),
    estado: renderEstado(t),
    nota: t.grade ?? pc.dim("—"),
  }));

  console.log(
    renderSection(
      `Tareas — ${logicalCourse.code} (${logicalCourse.name})`,
      renderTable(rows, [
        { header: "ID", key: "id" },
        { header: "Secc.", key: "seccion" },
        { header: "Nombre", key: "nombre", maxWidth: 45 },
        { header: "Vencimiento", key: "vencimiento" },
        { header: "Pts", key: "puntos" },
        { header: "Estado", key: "estado" },
        { header: "Nota", key: "nota" },
      ]),
    ),
  );
}
