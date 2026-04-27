// wiener archivos <ref> — flat file listing for a logical course
// Uses module items (type=File) as source since /courses/{id}/files is restricted by Wiener admin.

import pc from "picocolors";
import { fetchActiveCourses } from "../../lib/api/canvas/courses.js";
import { fetchModuleFileItems } from "../../lib/api/canvas/modules.js";
import { groupBySection } from "../../lib/courses/grouping.js";
import { resolveCourse } from "../../lib/courses/resolver.js";
import { WienerRestrictedError, toErrorEnvelope } from "../../lib/errors.js";
import { err, ok } from "../../lib/output/envelope.js";
import { renderSection } from "../../lib/output/human.js";
import { emit } from "../../lib/output/json.js";
import { emitStream } from "../../lib/output/ndjson.js";
import { renderTable } from "../../lib/output/responsive-table.js";
import { pMap } from "../../lib/parallel.js";
import type { SectionType } from "../../types/course.js";

export async function runArchivos(
  ref: string,
  opts: {
    json?: boolean;
    ndjson?: boolean;
    seccion?: SectionType;
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
    const secciones = resolvedCourse.secciones;
    const filtered = opts.seccion ? secciones.filter((s) => s.seccion === opts.seccion) : secciones;

    const allItems = await pMap(
      filtered,
      async (s) => {
        try {
          const items = await fetchModuleFileItems(Number(s.id));
          return items.map((item) => {
            const ext = item.title.includes(".")
              ? (item.title.split(".").pop()?.toLowerCase() ?? "—")
              : "—";
            return {
              id: item.id,
              content_id: item.content_id,
              name: item.title,
              download_url: item.url,
              module_name: item.module_name,
              module_id: item.module_id,
              type: ext,
              seccion: s.seccion,
            };
          });
        } catch (e) {
          if (e instanceof WienerRestrictedError) return [];
          throw e;
        }
      },
      4,
    );

    const archivos = allItems.flat();

    const cursoInfo = {
      code: resolvedCourse.code,
      alias: resolvedCourse.alias,
      name: resolvedCourse.name,
    };
    const data = { curso: cursoInfo, archivos };

    if (opts.json) {
      emit(ok(data));
      return;
    }
    if (opts.ndjson) {
      await emitStream(
        (async function* () {
          for (const f of archivos) yield f;
        })(),
      );
      return;
    }

    if (archivos.length === 0) {
      console.log(
        `${pc.dim(`No hay archivos en módulos de ${resolvedCourse.code}`)}\n${pc.dim("  Wiener restringe /files — solo se muestran archivos adjuntos a módulos.")}`,
      );
      console.log(
        `\n  ${pc.dim("→")} ${pc.cyan(`wiener cursos abrir ${ref}`)}   ${pc.dim("abrir el portal y descargar manualmente")}`,
      );
      return;
    }

    const moduleCounts = new Map<string, number>();
    for (const f of archivos) {
      moduleCounts.set(f.module_name, (moduleCounts.get(f.module_name) ?? 0) + 1);
    }
    const moduleCount = moduleCounts.size;

    console.log(
      renderSection(
        `Archivos — ${resolvedCourse.code} · ${resolvedCourse.name ?? ""}`,
        renderTable(archivos, [
          {
            header: "Módulo",
            get: (f) => f.module_name,
            weight: 2,
            min: 12,
            max: 30,
            show: "always",
            priority: 7,
          },
          {
            header: "Archivo",
            get: (f) => f.name,
            weight: 3,
            min: 20,
            show: "always",
            priority: 9,
          },
          {
            header: "Tipo",
            get: (f) => f.type,
            fixed: 6,
            show: "wide",
            priority: 3,
          },
        ]),
      ),
    );

    console.log(pc.dim(`\n  Total: ${archivos.length} archivos en ${moduleCount} módulos`));
    console.log(`\n  ${pc.dim("→")} ${pc.cyan("wiener archivos download <id> --out ./material")}`);
    console.log(
      `  ${pc.dim("→")} ${pc.cyan(`wiener modulos ${ref}`)}   ${pc.dim("ver módulos completos")}`,
    );
  } catch (e) {
    if (opts.json) {
      emit(toErrorEnvelope(e));
      return;
    }
    process.stderr.write(`Error: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
  }
}
