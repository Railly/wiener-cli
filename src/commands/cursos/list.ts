import Table from "cli-table3";
import type { Command } from "commander";
import pc from "picocolors";
import { NEXT_STEPS, emitNextSteps } from "../../lib/agent/next-steps.js";
import { getActiveCoursesWithToken as getActiveCourses } from "../../lib/api/canvas/courses.js";
import { loadCanvasSession } from "../../lib/auth/store.js";
import { getProfileAliases } from "../../lib/courses/alias-store.js";
import { generateAliasMap } from "../../lib/courses/auto-alias.js";
import { groupBySection } from "../../lib/courses/grouping.js";
import type { WienerError } from "../../lib/errors.js";
import { err, ok } from "../../lib/output/envelope.js";
import { printError } from "../../lib/output/human.js";
import { emitJson } from "../../lib/output/json.js";

interface ListOptions {
  json?: boolean;
  all?: boolean;
  profile?: string;
  favoritos?: boolean;
}

function buildCursosTable(
  rows: { code: string; name: string; alias: string; secciones: string; term?: string }[],
  color: boolean,
): string {
  const table = new Table({
    head: [
      color ? pc.bold(pc.cyan("Código")) : "Código",
      color ? pc.bold(pc.cyan("Nombre")) : "Nombre",
      color ? pc.bold(pc.cyan("Alias")) : "Alias",
      color ? pc.bold(pc.cyan("Secc.")) : "Secc.",
      color ? pc.bold(pc.cyan("Término")) : "Término",
    ],
    style: { head: [], border: color ? ["dim"] : [] },
    chars: {
      top: "─",
      "top-mid": "┬",
      "top-left": "╭",
      "top-right": "╮",
      bottom: "─",
      "bottom-mid": "┴",
      "bottom-left": "╰",
      "bottom-right": "╯",
      left: "│",
      "left-mid": "├",
      mid: "─",
      "mid-mid": "┼",
      right: "│",
      "right-mid": "┤",
      middle: "│",
    },
  });

  for (const row of rows) {
    table.push([
      color ? pc.bold(pc.yellow(row.code)) : row.code,
      color ? pc.white(row.name) : row.name,
      color ? pc.dim(row.alias) : row.alias,
      row.secciones,
      color ? pc.dim(row.term ?? "—") : (row.term ?? "—"),
    ]);
  }

  return table.toString();
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
      const color = !process.env.NO_COLOR && process.stdout.isTTY === true;

      const session = await loadCanvasSession(profile);
      if (!session) {
        const envelope = err(
          "canvas-not-configured",
          "Canvas PAT not configured",
          "Run `wiener auth canvas set-token <pat>`",
        );
        if (opts.json) emitJson(envelope);
        printError(envelope.error.code, envelope.error.message, envelope.error.hint);
        emitNextSteps(
          NEXT_STEPS.canvasRequired as readonly { command: string; description: string }[],
        );
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
          if (opts.json) {
            emitJson(ok(data, { duration_ms: Date.now() - start }));
            return;
          }
          const rows = data.cursos.map((c) => ({
            code: c.code,
            name: c.name,
            alias: c.alias,
            secciones: "—",
            term: c.term,
          }));
          const header = "Cursos (todos)";
          console.log("");
          console.log(color ? pc.bold(pc.cyan(header)) : header);
          console.log(buildCursosTable(rows, color));
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
          if (opts.json) {
            emitJson(ok(data, { duration_ms: Date.now() - start }));
            return;
          }
          const rows = data.cursos.map((c) => ({
            code: c.code,
            name: c.name,
            alias: c.alias,
            secciones: c.secciones.map((s) => s.seccion).join("/"),
            term: c.term,
          }));
          const header = `Cursos activos (${rows.length})`;
          console.log("");
          console.log(color ? pc.bold(pc.cyan(header)) : header);
          console.log(buildCursosTable(rows, color));
        }

        emitNextSteps(
          NEXT_STEPS.afterCursos as readonly { command: string; description: string }[],
        );
        process.exit(0);
      } catch (e) {
        const wienerErr = e as WienerError;
        const envelope = err(wienerErr.code ?? "unknown-error", wienerErr.message, wienerErr.hint);
        if (opts.json) emitJson(envelope);
        printError(envelope.error.code, envelope.error.message, envelope.error.hint);
        emitNextSteps(
          NEXT_STEPS.authRequired as readonly { command: string; description: string }[],
        );
        process.exit(1);
      }
    });
}
