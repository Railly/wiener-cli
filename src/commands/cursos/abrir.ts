import type { Command } from "commander";
import { getActiveCoursesWithToken as getActiveCourses } from "../../lib/api/canvas/courses.js";
import { loadCanvasSession } from "../../lib/auth/store.js";
import { openInBrowser } from "../../lib/browser-open.js";
import { getProfileAliases } from "../../lib/courses/alias-store.js";
import { generateAliasMap } from "../../lib/courses/auto-alias.js";
import { groupBySection } from "../../lib/courses/grouping.js";
import { resolveCourse } from "../../lib/courses/resolver.js";
import type { WienerError } from "../../lib/errors.js";
import { err, ok } from "../../lib/output/envelope.js";
import { printError, printSuccess } from "../../lib/output/human.js";
import { emitJson } from "../../lib/output/json.js";
import { DEFAULT_CONFIG } from "../../types/config.js";
import type { Course } from "../../types/course.js";

interface AbrirOptions {
  json?: boolean;
  profile?: string;
  exact?: boolean;
}

export function registerCursosAbrir(cursosCmd: Command): void {
  cursosCmd
    .command("abrir <ref>")
    .description("Open a course in the default browser")
    .option("--json", "Output JSON envelope")
    .option("--profile <name>", "Profile to use", "default")
    .option("--exact", "Require exact code/alias match")
    .action(async (ref: string, opts: AbrirOptions) => {
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

        if (resolution.kind === "no-match" || resolution.kind === "ambiguous") {
          const code = resolution.kind === "no-match" ? "course-not-found" : "course-ambiguous";
          const envelope = err(
            code,
            `Could not resolve "${ref}"`,
            "Run `wiener cursos` to see available courses",
          );
          if (opts.json) emitJson(envelope);
          printError(envelope.error.code, envelope.error.message, envelope.error.hint);
          process.exit(1);
        }

        const course = resolution.course;
        const canvasId = course.secciones[0]?.id ?? course.id;
        const url = `${DEFAULT_CONFIG.canvas.base_url}/courses/${canvasId}`;
        await openInBrowser(url);

        const data = { ok: true, url_opened: url };
        if (opts.json) emitJson(ok(data, { duration_ms: Date.now() - start }));
        printSuccess(`Abriendo ${url}`);
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
