// wiener modulos <ref> — Canvas modules with items

import pc from "picocolors";
import { fetchActiveCourses } from "../lib/api/canvas/courses.js";
import { fetchModules } from "../lib/api/canvas/modules.js";
import { groupBySection } from "../lib/courses/grouping.js";
import { resolveCourse } from "../lib/courses/resolver.js";
import { toErrorEnvelope } from "../lib/errors.js";
import { err, ok } from "../lib/output/envelope.js";
import { renderSection } from "../lib/output/human.js";
import { emit } from "../lib/output/json.js";
import { pMap } from "../lib/parallel.js";
import type { CanvasCourse } from "../types/canvas.js";
import type { Course, SectionType } from "../types/course.js";

function toList(canvasCourses: CanvasCourse[]): Course[] {
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

export async function runModulos(
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
    const courses = toList(canvasCourses);
    const resolution = resolveCourse(ref, courses, { exact: opts.exact, noInput: opts.noInput });

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

    const resolvedCourse = resolution.kind === "exact" ? resolution.course : resolution.course;
    const logical = groupBySection(courses);
    const logicalCourse = logical.find((lc) => lc.code === resolvedCourse.code);

    const secciones = logicalCourse?.secciones ?? [
      { id: resolvedCourse.id, canvasName: resolvedCourse.canvasName, seccion: "T" as SectionType },
    ];
    const filtered = opts.seccion ? secciones.filter((s) => s.seccion === opts.seccion) : secciones;

    const allModules = await pMap(
      filtered,
      async (s) => {
        const mods = await fetchModules(s.id);
        return mods.map((m) => ({
          seccion: s.seccion,
          id: m.id,
          name: m.name,
          position: m.position,
          state: m.workflow_state,
          items: (m.items ?? []).map((item) => ({
            id: item.id,
            type: item.type,
            title: item.title,
            url: item.html_url ?? item.url ?? item.external_url ?? null,
            completion_requirement: item.completion_requirement ?? null,
          })),
        }));
      },
      4,
    );

    const modulos = allModules.flat().sort((a, b) => a.position - b.position);
    const cursoInfo = {
      code: resolvedCourse.code,
      alias: resolvedCourse.alias,
      name: resolvedCourse.name,
    };
    const data = { curso: cursoInfo, modulos };

    if (opts.json) {
      emit(ok(data));
      return;
    }

    if (modulos.length === 0) {
      console.log(pc.dim(`No hay módulos en ${resolvedCourse.code}.`));
      return;
    }

    let output = "";
    for (const mod of modulos) {
      output += `\n${pc.bold(pc.cyan(`[${mod.seccion}] ${mod.name}`))} (${mod.items.length} items)\n`;
      for (const item of mod.items) {
        const typeTag = pc.dim(`[${item.type}]`);
        const completion = item.completion_requirement
          ? item.completion_requirement.completed
            ? pc.green(" ✓")
            : pc.dim(" ○")
          : "";
        const url = item.url ? pc.dim(` → ${item.url.slice(0, 60)}`) : "";
        output += `  ${typeTag} ${item.title}${completion}${url}\n`;
      }
    }

    console.log(renderSection(`Módulos — ${resolvedCourse.code}`, output));
  } catch (e) {
    if (opts.json) {
      emit(toErrorEnvelope(e));
      return;
    }
    process.stderr.write(`Error: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
  }
}
