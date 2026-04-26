import type { Command } from "commander";
import { getActiveCoursesWithToken as getActiveCourses } from "../../lib/api/canvas/courses.js";
import { loadCanvasSession } from "../../lib/auth/store.js";
import { getProfileAliases } from "../../lib/courses/alias-store.js";
import { generateAliasMap } from "../../lib/courses/auto-alias.js";
import { groupBySection } from "../../lib/courses/grouping.js";
import type { WienerError } from "../../lib/errors.js";
import { err, ok } from "../../lib/output/envelope.js";
import { printTable } from "../../lib/output/human.js";
import { printError } from "../../lib/output/human.js";
import { emitJson } from "../../lib/output/json.js";

interface ListOptions {
  json?: boolean;
  all?: boolean;
  profile?: string;
  favoritos?: boolean;
}

export function registerCursosList(cursosCmd: Command): void {
  cursosCmd
    .command("list")
    .alias("")
    .description("List active courses (grouped by code by default)")
    .option("--json", "Output JSON envelope")
    .option("--all", "Show all Canvas courses (not grouped)")
    .option("--profile <name>", "Profile to use", "default")
    .action(async (opts: ListOptions) => {
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

        if (opts.all) {
          const data = {
            cursos: rawCourses.map((c) => ({
              id: c.id,
              code: c.course_code,
              name: c.name,
              alias: aliasMap[c.course_code] ?? c.course_code.toLowerCase(),
              term: c.term?.name,
              role: c.enrollments?.[0]?.role,
            })),
          };
          if (opts.json) emitJson(ok(data, { duration_ms: Date.now() - start }));
          printTable(data.cursos, [
            { header: "Code", key: "code" },
            { header: "Name", key: "name" },
            { header: "Alias", key: "alias" },
            { header: "Term", key: "term" },
          ]);
        } else {
          const logical = groupBySection(rawCourses, aliasMap);
          const data = {
            cursos: logical.map((l) => ({
              code: l.code,
              name: l.name,
              alias: l.alias,
              secciones: l.secciones,
              term: l.term,
              role: l.role,
            })),
          };
          if (opts.json) emitJson(ok(data, { duration_ms: Date.now() - start }));
          printTable(
            data.cursos.map((c) => ({
              ...c,
              secciones: c.secciones.map((s) => s.seccion).join("/"),
            })),
            [
              { header: "Code", key: "code" },
              { header: "Name", key: "name" },
              { header: "Alias", key: "alias" },
              { header: "Sections", key: "secciones" },
              { header: "Term", key: "term" },
            ],
          );
        }
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
