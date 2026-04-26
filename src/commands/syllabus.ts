// wiener syllabus <ref>

import { fetchCourse } from "../lib/api/canvas/courses.js";
import { fetchActiveCourses } from "../lib/api/canvas/courses.js";
import { resolveCourse } from "../lib/courses/resolver.js";
import { groupBySection } from "../lib/courses/grouping.js";
import { ok, err } from "../lib/output/envelope.js";
import { emit } from "../lib/output/json.js";
import { renderSection, htmlToText } from "../lib/output/human.js";
import { toErrorEnvelope } from "../lib/errors.js";
import type { CanvasCourse } from "../types/canvas.js";
import type { Course, SectionType } from "../types/course.js";
import pc from "picocolors";

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

export async function runSyllabus(
  ref: string,
  opts: {
    json?: boolean;
    exact?: boolean;
    noInput?: boolean;
  }
): Promise<void> {
  try {
    const canvasCourses = await fetchActiveCourses();
    const courses = toList(canvasCourses);
    const resolution = resolveCourse(ref, courses, { exact: opts.exact, noInput: opts.noInput });

    if (resolution.kind === "no-match" || resolution.kind === "ambiguous") {
      const errEnv = err("course-not-found", `No course matching "${ref}"`);
      if (opts.json) { emit(errEnv); return; }
      process.stderr.write(`No course matching "${ref}"\n`);
      process.exit(1);
      return;
    }

    const resolvedCourse = resolution.kind === "exact" ? resolution.course : resolution.course;
    const logical = groupBySection(courses);
    const logicalCourse = logical.find((lc) => lc.code === resolvedCourse.code);

    const primarySection = logicalCourse?.secciones[0];
    const courseId = primarySection?.id ?? resolvedCourse.id;

    const courseDetail = await fetchCourse(courseId, true);
    const syllabusHtml = courseDetail.syllabus_body ?? "";
    const syllabusText = syllabusHtml ? htmlToText(syllabusHtml) : "";

    const cursoInfo = { code: resolvedCourse.code, alias: resolvedCourse.alias, name: resolvedCourse.name };
    const data = { curso: cursoInfo, syllabus_html: syllabusHtml, syllabus_text: syllabusText };

    if (opts.json) { emit(ok(data)); return; }

    if (!syllabusText) {
      console.log(pc.dim(`No hay silabo disponible para ${resolvedCourse.code}.`));
      return;
    }

    console.log(renderSection(`Silabo — ${resolvedCourse.code}`, syllabusText));
  } catch (e) {
    if (opts.json) { emit(toErrorEnvelope(e)); return; }
    process.stderr.write(`Error: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
  }
}
