import type { Command } from "commander";
import { getFavoriteCourses } from "../../lib/api/canvas/courses.js";
import { loadCanvasSession } from "../../lib/auth/store.js";
import { getProfileAliases } from "../../lib/courses/alias-store.js";
import { generateAliasMap } from "../../lib/courses/auto-alias.js";
import { groupBySection } from "../../lib/courses/grouping.js";
import type { WienerError } from "../../lib/errors.js";
import { err, ok } from "../../lib/output/envelope.js";
import { printError } from "../../lib/output/human.js";
import { renderTable } from "../../lib/output/responsive-table.js";
import { emitJson } from "../../lib/output/json.js";

interface FavoritosOptions {
  json?: boolean;
  profile?: string;
}

export function registerCursosFavoritos(cursosCmd: Command): void {
  cursosCmd
    .command("favoritos")
    .description("Show favorite/pinned Canvas courses")
    .option("--json", "Output JSON envelope")
    .option("--profile <name>", "Profile to use", "default")
    .action(async (opts: FavoritosOptions) => {
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
        const rawCourses = await getFavoriteCourses(session.token);
        const customAliases = getProfileAliases(profile);
        const autoAliases = generateAliasMap(
          rawCourses.map((c) => ({ code: c.course_code, name: c.name })),
        );
        const aliasMap = { ...autoAliases, ...customAliases };
        const logical = groupBySection(rawCourses, aliasMap);

        const data = { cursos: logical };
        if (opts.json) emitJson(ok(data, { duration_ms: Date.now() - start }));
        console.log(
          renderTable(logical, [
            { header: "Code", get: (c) => c.code, fixed: 12, show: "always", priority: 10 },
            { header: "Name", get: (c) => c.name, weight: 2, min: 20, show: "always", priority: 9 },
            { header: "Alias", get: (c) => c.alias, fixed: 12, show: "wide", priority: 5 },
          ]),
        );
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
