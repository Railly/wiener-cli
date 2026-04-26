// wiener archivos arbol <ref> — folder tree for a course

import pc from "picocolors";
import { fetchActiveCourses } from "../../lib/api/canvas/courses.js";
import { buildFileTree } from "../../lib/api/canvas/files.js";
import type { FileTreeNode } from "../../lib/api/canvas/files.js";
import { groupBySection } from "../../lib/courses/grouping.js";
import { resolveCourse } from "../../lib/courses/resolver.js";
import { toErrorEnvelope } from "../../lib/errors.js";
import { err, ok } from "../../lib/output/envelope.js";
import { formatBytes } from "../../lib/output/human.js";
import { emit } from "../../lib/output/json.js";
import type { CanvasCourse } from "../../types/canvas.js";
import type { Course, SectionType } from "../../types/course.js";

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

function serializeTree(node: FileTreeNode): unknown {
  return {
    name: node.folder.name,
    files: node.files.map((f) => ({
      id: f.id,
      name: f.display_name,
      size: f.size,
      modified_at: f.modified_at,
      download_url: f.url,
    })),
    folders: node.subfolders.map(serializeTree),
  };
}

function printTree(node: FileTreeNode, depth = 0): void {
  const indent = "  ".repeat(depth);
  console.log(`${indent}${pc.bold(pc.blue(node.folder.name))}/`);
  for (const file of node.files) {
    console.log(`${indent}  ${file.display_name} ${pc.dim(formatBytes(file.size))}`);
  }
  for (const sub of node.subfolders) {
    printTree(sub, depth + 1);
  }
}

export async function runArchivosArbol(
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
    const primarySection = opts.seccion
      ? (secciones.find((s) => s.seccion === opts.seccion) ?? secciones[0])
      : secciones[0];

    if (!primarySection) {
      const errEnv = err("course-not-found", "No sections found");
      if (opts.json) {
        emit(errEnv);
        return;
      }
      process.stderr.write("No sections found\n");
      process.exit(1);
      return;
    }

    const root = await buildFileTree(primarySection.id);
    const cursoInfo = {
      code: resolvedCourse.code,
      alias: resolvedCourse.alias,
      name: resolvedCourse.name,
    };

    if (opts.json) {
      emit(ok({ curso: cursoInfo, root: root ? serializeTree(root) : null }));
      return;
    }

    console.log(pc.bold(`\nArchivos — ${resolvedCourse.code} [${primarySection.seccion}]`));
    if (!root) {
      console.log(pc.dim("  (no hay archivos)"));
      return;
    }
    printTree(root);
  } catch (e) {
    if (opts.json) {
      emit(toErrorEnvelope(e));
      return;
    }
    process.stderr.write(`Error: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
  }
}
