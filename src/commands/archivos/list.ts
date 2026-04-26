// wiener archivos <ref> — flat file listing for a logical course

import pc from "picocolors";
import { fetchActiveCourses } from "../../lib/api/canvas/courses.js";
import { fetchCourseFiles } from "../../lib/api/canvas/files.js";
import { groupBySection } from "../../lib/courses/grouping.js";
import { resolveCourse } from "../../lib/courses/resolver.js";
import { toErrorEnvelope } from "../../lib/errors.js";
import { err, ok } from "../../lib/output/envelope.js";
import { formatBytes, formatDate, renderSection, renderTable } from "../../lib/output/human.js";
import { emit } from "../../lib/output/json.js";
import { emitStream } from "../../lib/output/ndjson.js";
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

    const allFiles = await pMap(
      filtered,
      async (s) => {
        const files = await fetchCourseFiles(Number(s.id));
        return files.map((f) => ({
          id: f.id,
          name: f.display_name,
          path: f.filename,
          size: f.size,
          size_human: formatBytes(f.size),
          modified_at: f.modified_at,
          download_url: f.url,
          content_type: f["content-type"],
          seccion: s.seccion,
        }));
      },
      4,
    );

    const archivos = allFiles.flat().sort((a, b) => b.modified_at.localeCompare(a.modified_at));
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
      console.log(pc.dim(`No hay archivos en ${resolvedCourse.code}.`));
      return;
    }

    const rows = archivos.map((f) => ({
      id: String(f.id),
      secc: f.seccion,
      nombre: f.name,
      tamano: f.size_human,
      modificado: formatDate(f.modified_at),
      tipo: f.content_type.split("/")[1] ?? f.content_type,
    }));

    console.log(
      renderSection(
        `Archivos — ${resolvedCourse.code}`,
        renderTable(rows, [
          { header: "ID", key: "id" },
          { header: "Secc.", key: "secc" },
          { header: "Nombre", key: "nombre", maxWidth: 50 },
          { header: "Tamaño", key: "tamano" },
          { header: "Modificado", key: "modificado" },
          { header: "Tipo", key: "tipo", maxWidth: 20 },
        ]),
      ),
    );

    console.log(pc.dim(`\n  Total: ${archivos.length} archivos`));
  } catch (e) {
    if (opts.json) {
      emit(toErrorEnvelope(e));
      return;
    }
    process.stderr.write(`Error: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
  }
}
