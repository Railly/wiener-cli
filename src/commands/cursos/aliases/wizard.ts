import { cancel, intro, isCancel, outro, text } from "@clack/prompts";
import type { Command } from "commander";
import { getActiveCoursesWithToken as getActiveCourses } from "../../../lib/api/canvas/courses.js";
import { loadCanvasSession } from "../../../lib/auth/store.js";
import { getProfileAliases, setAlias } from "../../../lib/courses/alias-store.js";
import { generateAliasMap } from "../../../lib/courses/auto-alias.js";
import { groupBySection } from "../../../lib/courses/grouping.js";
import type { WienerError } from "../../../lib/errors.js";
import { err, ok } from "../../../lib/output/envelope.js";
import { printError } from "../../../lib/output/human.js";
import { emitJson } from "../../../lib/output/json.js";
import { shouldPrompt } from "../../../lib/tty.js";

interface WizardOptions {
  json?: boolean;
  profile?: string;
  noInput?: boolean;
}

export function registerAliasWizard(aliasesCmd: Command): void {
  aliasesCmd
    .command("wizard")
    .alias("")
    .description("Interactive alias wizard — configure shortcuts for each course")
    .option("--json", "Output JSON envelope")
    .option("--profile <name>", "Profile to use", "default")
    .option("--no-input", "Non-interactive mode (noop)")
    .action(async (opts: WizardOptions) => {
      const start = Date.now();
      const profile = opts.profile ?? "default";

      if (!shouldPrompt(opts.noInput)) {
        const envelope = err(
          "validation-error",
          "Alias wizard requires interactive mode",
          "Run without --no-input in a terminal",
        );
        if (opts.json) emitJson(envelope);
        printError(envelope.error.code, envelope.error.message, envelope.error.hint);
        process.exit(2);
      }

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

        intro("Configurando aliases (Enter para mantener actual, Ctrl+C salir).");

        const saved: Record<string, string> = {};
        let customized = 0;

        for (let i = 0; i < logical.length; i++) {
          const course = logical[i];
          if (!course) continue;
          const currentAlias = course.alias;

          const sections = course.secciones.map((s) => s.seccion).join("+");
          const label = `[${i + 1}/${logical.length}] ${course.code} — ${course.name} (${sections})`;
          const newAlias = await text({
            message: `${label}\n      Alias actual: ${currentAlias}`,
            placeholder: currentAlias,
            defaultValue: currentAlias,
          });

          if (isCancel(newAlias)) {
            cancel("Cancelado.");
            process.exit(0);
          }

          const chosen = String(newAlias).trim() || currentAlias;
          saved[course.code] = chosen;
          if (chosen !== currentAlias) {
            setAlias(course.code, chosen, profile);
            customized++;
          }
        }

        outro(
          `✓ ${customized} aliases personalizados, ${logical.length - customized} mantenidos en default\n  Guardado en ~/.wiener/aliases.json`,
        );

        const data = { ok: true, aliases: saved };
        if (opts.json) emitJson(ok(data, { duration_ms: Date.now() - start }));
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
