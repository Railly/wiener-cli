import type { Command } from "commander";
import { getActiveCoursesWithToken as getActiveCourses } from "../../lib/api/canvas/courses.js";
import { loadCanvasSession } from "../../lib/auth/store.js";
import { getProfileAliases } from "../../lib/courses/alias-store.js";
import { generateAliasMapByCodeName } from "../../lib/courses/auto-alias.js";
import { groupBySection } from "../../lib/courses/grouping.js";
import type { WienerError } from "../../lib/errors.js";
import { err, ok } from "../../lib/output/envelope.js";
import { printError } from "../../lib/output/human.js";
import { renderTable } from "../../lib/output/responsive-table.js";
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
        const autoAliases = generateAliasMapByCodeName(
          rawCourses.map((c) => ({ code: c.course_code, name: c.name })),
        );
        const aliasMap = { ...autoAliases, ...customAliases };

        if (opts.all) {
          const allLogical = groupBySection(rawCourses, aliasMap);
          const aliasById = new Map<string, string>();
          for (const l of allLogical) {
            for (const s of l.secciones) aliasById.set(s.id, l.alias);
          }
          const data = {
            cursos: rawCourses.map((c) => ({
              id: c.id,
              code: c.course_code,
              name: c.name,
              alias: aliasById.get(c.id) ?? c.course_code.toLowerCase(),
              term: c.term?.name,
              role: c.enrollments?.[0]?.role,
            })),
          };
          if (opts.json) emitJson(ok(data, { duration_ms: Date.now() - start }));
          console.log(
            renderTable(data.cursos, [
              { header: "Code", get: (c) => c.code, fixed: 12, show: "always", priority: 10 },
              { header: "Name", get: (c) => c.name ?? "", weight: 2, min: 20, show: "always", priority: 9 },
              { header: "Alias", get: (c) => c.alias, fixed: 12, show: "wide", priority: 5 },
              { header: "Term", get: (c) => c.term ?? "—", fixed: 10, show: "wide", priority: 4 },
            ]),
          );
        } else {
          const logical = groupBySection(rawCourses, aliasMap);
          const data = {
            cursos: logical.map((l) => ({
              code: l.code,
              name: l.name,
              alias: l.alias,
              secciones: l.secciones.map((s) => s.seccion).join("/"),
              term: l.term,
              role: l.role,
            })),
          };
          if (opts.json) emitJson(ok({ cursos: logical.map((l) => ({ code: l.code, name: l.name, alias: l.alias, secciones: l.secciones, term: l.term, role: l.role })) }, { duration_ms: Date.now() - start }));
          console.log(
            renderTable(data.cursos, [
              { header: "Code", get: (c) => c.code, fixed: 12, show: "always", priority: 10 },
              { header: "Name", get: (c) => c.name, weight: 2, min: 20, show: "always", priority: 9 },
              { header: "Alias", get: (c) => c.alias, fixed: 12, show: "wide", priority: 5 },
              { header: "Sections", get: (c) => c.secciones, fixed: 9, show: "wide", priority: 4 },
              { header: "Term", get: (c) => c.term ?? "—", fixed: 10, show: "wide", priority: 3 },
            ]),
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
