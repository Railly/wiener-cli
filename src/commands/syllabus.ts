// wiener syllabus <ref>

import pc from "picocolors";
import { fetchCourse } from "../lib/api/canvas/courses.js";
import { fetchActiveCourses } from "../lib/api/canvas/courses.js";
import { groupBySection } from "../lib/courses/grouping.js";
import { resolveCourse } from "../lib/courses/resolver.js";
import { toErrorEnvelope } from "../lib/errors.js";
import { err, ok } from "../lib/output/envelope.js";
import { htmlToText, renderSection } from "../lib/output/human.js";
import { emit } from "../lib/output/json.js";

export async function runSyllabus(
  ref: string,
  opts: {
    json?: boolean;
    exact?: boolean;
    noInput?: boolean;
  },
): Promise<void> {
  try {
    const canvasCourses = await fetchActiveCourses();
    const logical = groupBySection(canvasCourses);
    const resolution = resolveCourse(ref, logical, { exact: opts.exact, noInput: opts.noInput });

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

    const resolvedCourse = resolution.course;
    const primarySection = resolvedCourse.secciones[0];
    const courseId = primarySection?.id ?? "";

    const courseDetail = await fetchCourse(Number(courseId), true);
    const syllabusHtml = courseDetail.syllabus_body ?? "";
    const syllabusText = syllabusHtml ? htmlToText(syllabusHtml) : "";

    const cursoInfo = {
      code: resolvedCourse.code,
      alias: resolvedCourse.alias,
      name: resolvedCourse.name,
    };
    const data = { curso: cursoInfo, syllabus_html: syllabusHtml, syllabus_text: syllabusText };

    if (opts.json) {
      emit(ok(data));
      return;
    }

    if (!syllabusText) {
      console.log(pc.dim(`No hay silabo disponible para ${resolvedCourse.code}.`));
      return;
    }

    console.log(renderSection(`Silabo — ${resolvedCourse.code}`, syllabusText));
  } catch (e) {
    if (opts.json) {
      emit(toErrorEnvelope(e));
      return;
    }
    process.stderr.write(`Error: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
  }
}
