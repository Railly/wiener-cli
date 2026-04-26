import type { Command } from "commander";
import {
  getActiveCoursesWithToken as getActiveCourses,
  getCourse,
} from "../../lib/api/canvas/courses.js";
import { loadCanvasSession } from "../../lib/auth/store.js";
import { getProfileAliases } from "../../lib/courses/alias-store.js";
import { generateAliasMap } from "../../lib/courses/auto-alias.js";
import { groupBySection } from "../../lib/courses/grouping.js";
import { resolveCourse } from "../../lib/courses/resolver.js";
import type { WienerError } from "../../lib/errors.js";
import { err, ok } from "../../lib/output/envelope.js";
import { printError, printKeyValue } from "../../lib/output/human.js";
import { emitJson } from "../../lib/output/json.js";
import type { Course } from "../../types/course.js";

interface InfoOptions {
  json?: boolean;
  profile?: string;
  exact?: boolean;
}

export function registerCursosInfo(cursosCmd: Command): void {
  cursosCmd
    .command("info <ref>")
    .description("Show details for a course")
    .option("--json", "Output JSON envelope")
    .option("--profile <name>", "Profile to use", "default")
    .option("--exact", "Require exact code/alias match")
    .action(async (ref: string, opts: InfoOptions) => {
      const start = Date.now();
      const profile = opts.profile ?? "default";

      const session = await loadCanvasSession(profile);
      if (!session) {
        const envelope = err(
          "canvas-not-configured",
          "Canvas PAT not configured",
          "Run `wiener auth canvas set-token <pat>`",
        );
        if (opts.json) emitJson(envelope);
        printError(envelope.error.code, envelope.error.message, envelope.error.hint);
        process.exit(1);
      }

      try {
        const rawCourses = await getActiveCourses(session.token);
        const customAliases = getProfileAliases(profile);
        const autoAliases = generateAliasMap(
          rawCourses.map((c) => ({ code: c.course_code, name: c.name })),
        );
        const aliasMap = { ...autoAliases, ...customAliases };
        const logical = groupBySection(rawCourses, aliasMap);
        const courses: Course[] = logical.map((l) => ({ id: l.secciones[0]?.id ?? "", ...l }));

        const resolution = resolveCourse(ref, courses, { exact: opts.exact });

        if (resolution.kind === "no-match") {
          const envelope = err(
            "course-not-found",
            `No course found matching "${ref}"`,
            "Run `wiener cursos` to see available courses",
            { closest: resolution.closest },
          );
          if (opts.json) emitJson(envelope);
          printError(envelope.error.code, envelope.error.message, envelope.error.hint);
          process.exit(1);
        }

        if (resolution.kind === "ambiguous") {
          const envelope = err(
            "course-ambiguous",
            `Multiple courses match "${ref}"`,
            "Try `wiener cursos` to see exact aliases",
            { candidates: resolution.candidates },
          );
          if (opts.json) emitJson(envelope);
          printError(envelope.error.code, envelope.error.message, envelope.error.hint);
          process.exit(1);
        }

        const course = resolution.kind === "exact" ? resolution.course : resolution.course;
        const details = await getCourse(session.token, course.secciones[0]?.id ?? course.id);

        const data = {
          code: course.code,
          name: course.name,
          alias: course.alias,
          secciones: course.secciones,
          term: course.term,
          role: course.role,
          canvas_id: details.id,
        };

        if (opts.json) emitJson(ok(data, { duration_ms: Date.now() - start }));
        printKeyValue(data as Record<string, unknown>);
        process.exit(0);
      } catch (e) {
        const wienerErr = e as WienerError;
        const envelope = err(wienerErr.code ?? "unknown-error", wienerErr.message, wienerErr.hint);
        if (opts.json) emitJson(envelope);
        printError(envelope.error.code, envelope.error.message, envelope.error.hint);
        process.exit(1);
      }
    });
}
