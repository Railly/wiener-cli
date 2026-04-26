// wiener conferencias <ref>

import pc from "picocolors";
import { fetchConferences } from "../lib/api/canvas/conferences.js";
import { fetchActiveCourses } from "../lib/api/canvas/courses.js";
import { groupBySection } from "../lib/courses/grouping.js";
import { resolveCourse } from "../lib/courses/resolver.js";
import { toErrorEnvelope } from "../lib/errors.js";
import { err, ok } from "../lib/output/envelope.js";
import { formatDate, renderSection, renderTable } from "../lib/output/human.js";
import { emit } from "../lib/output/json.js";
import { pMap } from "../lib/parallel.js";
import type { SectionType } from "../types/course.js";

export async function runConferencias(
  ref: string,
  opts: {
    json?: boolean;
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

    const allConferencias = await pMap(
      filtered,
      async (s) => {
        const confs = await fetchConferences(Number(s.id));
        return confs.map((c) => ({
          id: c.id,
          title: c.title,
          type: c.conference_type,
          started_at: c.started_at ?? null,
          ended_at: c.ended_at ?? null,
          recordings: (c.recordings ?? []).map((r) => ({
            url: r.playback_url,
            created_at: r.created_at,
          })),
          seccion: s.seccion,
        }));
      },
      4,
    );

    const conferencias = allConferencias
      .flat()
      .sort((a, b) => (b.started_at ?? "").localeCompare(a.started_at ?? ""));
    const cursoInfo = {
      code: resolvedCourse.code,
      alias: resolvedCourse.alias,
      name: resolvedCourse.name,
    };
    const data = { curso: cursoInfo, conferencias };

    if (opts.json) {
      emit(ok(data));
      return;
    }

    if (conferencias.length === 0) {
      console.log(pc.dim(`No hay conferencias en ${resolvedCourse.code}.`));
      return;
    }

    const rows = conferencias.map((c) => ({
      secc: c.seccion,
      titulo: c.title,
      tipo: c.type,
      inicio: formatDate(c.started_at),
      fin: formatDate(c.ended_at),
      grabaciones: c.recordings.length > 0 ? pc.green(String(c.recordings.length)) : pc.dim("0"),
    }));

    console.log(
      renderSection(
        `Conferencias — ${resolvedCourse.code}`,
        renderTable(rows, [
          { header: "Secc.", key: "secc" },
          { header: "Título", key: "titulo", maxWidth: 40 },
          { header: "Tipo", key: "tipo" },
          { header: "Inicio", key: "inicio" },
          { header: "Fin", key: "fin" },
          { header: "Grabs.", key: "grabaciones" },
        ]),
      ),
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
