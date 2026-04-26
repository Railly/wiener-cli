// wiener tareas — all pending tasks across all active courses
// wiener tareas <ref> — tasks for a specific course

import type { CanvasCourse } from "../../types/canvas.js";
import type { Course } from "../../types/course.js";
import { fetchAssignments } from "../../lib/api/canvas/assignments.js";
import { fetchUpcomingEvents, fetchTodoItems } from "../../lib/api/canvas/calendar.js";
import { fetchActiveCourses } from "../../lib/api/canvas/courses.js";
import { resolveCourse } from "../../lib/courses/resolver.js";
import { groupBySection, canvasCourseToLogical } from "../../lib/courses/grouping.js";
import { pMap } from "../../lib/parallel.js";
import { ok, err } from "../../lib/output/envelope.js";
import { emit } from "../../lib/output/json.js";
import { renderTable, renderSection, formatDate } from "../../lib/output/human.js";
import { projectFields } from "../../lib/output/fields.js";
import { toErrorEnvelope } from "../../lib/errors.js";
import type { SectionType } from "../../types/course.js";
import pc from "picocolors";

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
  url: string;
}

function canvasCoursesToCourseList(canvasCourses: CanvasCourse[]): Course[] {
  return canvasCourses.map((c) => ({
    id: c.id,
    code: c.course_code,
    name: c.name,
    alias: c.course_code.toLowerCase(),
    canvasName: c.name,
    term: c.term?.name,
    role: c.enrollments?.[0]?.role ?? "StudentEnrollment",
    calendarIcsUrl: c.calendar?.ics,
  }));
}

export async function runTareasList(opts: {
  json?: boolean;
  ndjson?: boolean;
  fields?: string;
  seccion?: SectionType;
}): Promise<void> {
  try {
    const [upcomingEvents, todoItems] = await Promise.all([
      fetchUpcomingEvents(),
      fetchTodoItems(),
    ]);

    const tareaMap = new Map<string, TareaItem>();

    for (const ev of upcomingEvents) {
      if (!ev.assignment) continue;
      const a = ev.assignment;
      const sub = a.submission;
      const key = `${a.course_id}-${a.id}`;
      if (tareaMap.has(key)) continue;

      const courseId = a.course_id;
      const courseCode = ev.context_code?.replace("course_", "") ?? String(courseId);

      tareaMap.set(key, {
        id: a.id,
        curso: { code: courseCode, alias: courseCode.toLowerCase(), seccion: "T", courseId },
        name: a.name,
        due_at: a.due_at ?? null,
        points: a.points_possible,
        submitted: sub ? sub.workflow_state !== "unsubmitted" : false,
        graded: sub ? sub.workflow_state === "graded" : false,
        grade: sub?.grade ?? null,
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
      tareaMap.set(key, {
        id: a.id,
        curso: { code: String(courseId), alias: String(courseId).toLowerCase(), seccion: "T", courseId },
        name: a.name,
        due_at: a.due_at ?? null,
        points: a.points_possible,
        submitted: sub ? sub.workflow_state !== "unsubmitted" : false,
        graded: sub ? sub.workflow_state === "graded" : false,
        grade: sub?.grade ?? null,
        url: a.html_url,
      });
    }

    let tareas = Array.from(tareaMap.values()).sort(
      (a, b) => (a.due_at ?? "").localeCompare(b.due_at ?? "")
    );

    if (opts.seccion) {
      tareas = tareas.filter((t) => t.curso.seccion === opts.seccion);
    }

    const data = { tareas };

    if (opts.json) {
      const envelope = ok(opts.fields ? projectFields(data as unknown as Record<string, unknown>, opts.fields) : data);
      emit(envelope);
      return;
    }

    if (opts.ndjson) {
      for (const t of tareas) process.stdout.write(JSON.stringify(t) + "\n");
      return;
    }

    if (tareas.length === 0) {
      console.log(pc.green("No hay tareas pendientes."));
      return;
    }

    const rows = tareas.map((t) => ({
      id: String(t.id),
      curso: `${t.curso.code} [${t.curso.seccion}]`,
      nombre: t.name,
      vencimiento: formatDate(t.due_at),
      puntos: String(t.points),
      estado: t.graded ? pc.green("calificado") : t.submitted ? pc.yellow("entregado") : pc.red("pendiente"),
      nota: t.grade ?? pc.dim("—"),
    }));

    console.log(renderSection("Tareas pendientes", renderTable(rows, [
      { header: "ID", key: "id" },
      { header: "Curso", key: "curso" },
      { header: "Nombre", key: "nombre", maxWidth: 40 },
      { header: "Vencimiento", key: "vencimiento" },
      { header: "Pts", key: "puntos" },
      { header: "Estado", key: "estado" },
      { header: "Nota", key: "nota" },
    ])));
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
  }
): Promise<void> {
  try {
    const canvasCourses = await fetchActiveCourses();
    const courses = canvasCoursesToCourseList(canvasCourses);
    const resolution = resolveCourse(ref, courses, { exact: opts.exact, noInput: opts.noInput });

    if (resolution.kind === "no-match") {
      const errEnv = err(
        "course-not-found",
        `No course matching "${ref}"`,
        "Try: wiener cursos",
        { closest: resolution.closest.map((c) => ({ code: c.course.code, name: c.course.name, score: c.score })) }
      );
      if (opts.json) { emit(errEnv); return; }
      process.stderr.write(`No course matching "${ref}"\n`);
      process.exit(1);
    }

    if (resolution.kind === "ambiguous") {
      const errEnv = err(
        "course-ambiguous",
        `Multiple courses match "${ref}"`,
        "Try: wiener cursos",
        { candidates: resolution.candidates.map((c) => ({ code: c.course.code, name: c.course.name, score: c.score })) }
      );
      if (opts.json) { emit(errEnv); return; }
      process.stderr.write(`Ambiguous: ${resolution.candidates.map((c) => c.course.code).join(", ")}\n`);
      process.exit(1);
    }

    const resolvedCourse = resolution.kind === "exact" ? resolution.course : resolution.course;
    const logical = groupBySection(courses);
    const logicalCourse = logical.find((lc) => lc.code === resolvedCourse.code);

    const secciones = logicalCourse?.secciones ?? [{ id: resolvedCourse.id, canvasName: resolvedCourse.canvasName, seccion: "T" as SectionType }];
    const filtered = opts.seccion ? secciones.filter((s) => s.seccion === opts.seccion) : secciones;

    const allTareas = await pMap(
      filtered,
      async (s) => {
        const assignments = await fetchAssignments(s.id);
        return assignments.map((a) => ({
          id: a.id,
          curso: {
            code: resolvedCourse.code,
            alias: resolvedCourse.alias,
            seccion: s.seccion,
            courseId: s.id,
          },
          name: a.name,
          due_at: a.due_at ?? null,
          points: a.points_possible,
          submitted: a.submission ? a.submission.workflow_state !== "unsubmitted" : false,
          graded: a.submission ? a.submission.workflow_state === "graded" : false,
          grade: a.submission?.grade ?? null,
          url: a.html_url,
        } satisfies TareaItem));
      },
      4
    );

    const tareas = allTareas.flat().sort((a, b) => (a.due_at ?? "").localeCompare(b.due_at ?? ""));
    const cursoInfo = {
      code: resolvedCourse.code,
      alias: resolvedCourse.alias,
      name: resolvedCourse.name,
    };

    const data = { curso: cursoInfo, tareas };

    if (opts.json) {
      const envelope = ok(opts.fields ? projectFields(data as unknown as Record<string, unknown>, opts.fields) : data);
      emit(envelope);
      return;
    }

    if (opts.ndjson) {
      for (const t of tareas) process.stdout.write(JSON.stringify(t) + "\n");
      return;
    }

    if (tareas.length === 0) {
      console.log(pc.green(`No hay tareas en ${resolvedCourse.code}.`));
      return;
    }

    const rows = tareas.map((t) => ({
      id: String(t.id),
      seccion: t.curso.seccion,
      nombre: t.name,
      vencimiento: formatDate(t.due_at),
      puntos: String(t.points),
      estado: t.graded ? pc.green("calificado") : t.submitted ? pc.yellow("entregado") : pc.red("pendiente"),
      nota: t.grade ?? pc.dim("—"),
    }));

    console.log(renderSection(
      `Tareas — ${resolvedCourse.code} (${resolvedCourse.name})`,
      renderTable(rows, [
        { header: "ID", key: "id" },
        { header: "Secc.", key: "seccion" },
        { header: "Nombre", key: "nombre", maxWidth: 45 },
        { header: "Vencimiento", key: "vencimiento" },
        { header: "Pts", key: "puntos" },
        { header: "Estado", key: "estado" },
        { header: "Nota", key: "nota" },
      ])
    ));
  } catch (e) {
    if (opts.json) {
      emit(toErrorEnvelope(e));
    } else {
      process.stderr.write(`Error: ${e instanceof Error ? e.message : String(e)}\n`);
    }
    process.exit(1);
  }
}
