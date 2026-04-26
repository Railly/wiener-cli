import type { StateSnapshots } from "../../types/state.js";
import type { CanvasAnnouncement, CanvasFileMeta, CanvasSubmission, CanvasModule } from "../../types/canvas.js";
import type { LogicalCourse } from "../../types/course.js";

export type DeltaTipo = "anuncio" | "archivo" | "calificacion" | "tarea" | "modulo";

export interface DeltaItem {
  tipo: DeltaTipo;
  curso: string;
  titulo: string;
  detalle: string;
  url: string;
  when: string;
}

export interface CurrentData {
  anuncios: CanvasAnnouncement[];
  archivos: Map<number, CanvasFileMeta[]>;
  submissions: CanvasSubmission[];
  modules: Map<number, CanvasModule[]>;
  courses: LogicalCourse[];
}

function courseCodeForId(courseId: number, courses: LogicalCourse[]): string {
  for (const c of courses) {
    for (const s of c.secciones) {
      if (s.id === courseId) return c.code;
    }
  }
  return String(courseId);
}

export function buildSnapshotsFromCurrent(data: CurrentData): StateSnapshots {
  const snap: StateSnapshots = {
    anuncios: { by_course: {} },
    archivos: { by_course: {} },
    calificaciones: { by_assignment: {} },
    tareas: { by_course: {} },
    modulos: { by_course: {} },
  };

  for (const ann of data.anuncios) {
    const courseId = ann.context_code.replace("course_", "");
    const existing = snap.anuncios.by_course[courseId];
    if (!existing || ann.id > Number(existing.last_id)) {
      snap.anuncios.by_course[courseId] = {
        last_id: String(ann.id),
        last_posted_at: ann.posted_at,
      };
    }
  }

  for (const [courseId, files] of data.archivos) {
    if (files.length === 0) continue;
    const sorted = [...files].sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
    snap.archivos.by_course[String(courseId)] = {
      last_modified_at: sorted[0]?.updated_at ?? new Date(0).toISOString(),
      file_ids: files.map((f) => String(f.id)),
    };
  }

  for (const sub of data.submissions) {
    if (sub.graded_at && sub.score !== null) {
      snap.calificaciones.by_assignment[String(sub.assignment_id)] = {
        score: sub.score,
        graded_at: sub.graded_at,
      };
    } else {
      snap.calificaciones.by_assignment[String(sub.assignment_id)] = {
        score: null,
        graded_at: null,
      };
    }
  }

  for (const [courseId, mods] of data.modules) {
    const totalItems = mods.reduce((sum, m) => sum + m.items_count, 0);
    snap.modulos.by_course[String(courseId)] = { items_count: totalItems };
  }

  return snap;
}

export function computeDiff(before: StateSnapshots, after: StateSnapshots, data: CurrentData): DeltaItem[] {
  const items: DeltaItem[] = [];
  const now = new Date().toISOString();

  for (const ann of data.anuncios) {
    const courseId = ann.context_code.replace("course_", "");
    const prev = before.anuncios.by_course[courseId];
    if (!prev || ann.id > Number(prev.last_id)) {
      const course = courseCodeForId(Number(courseId), data.courses);
      items.push({
        tipo: "anuncio",
        curso: course,
        titulo: ann.title,
        detalle: ann.author?.display_name ?? "",
        url: ann.html_url,
        when: ann.posted_at ?? now,
      });
    }
  }

  for (const [courseId, files] of data.archivos) {
    const prevSnap = before.archivos.by_course[String(courseId)];
    const prevIds = new Set(prevSnap?.file_ids ?? []);
    for (const file of files) {
      const isNew = !prevIds.has(String(file.id));
      const isModified =
        !isNew &&
        prevSnap?.last_modified_at &&
        new Date(file.updated_at) > new Date(prevSnap.last_modified_at);
      if (isNew || isModified) {
        const course = courseCodeForId(courseId, data.courses);
        const mb = (file.size / 1_048_576).toFixed(0);
        items.push({
          tipo: "archivo",
          curso: course,
          titulo: file.display_name,
          detalle: `${mb} MB`,
          url: file.url,
          when: file.updated_at,
        });
      }
    }
  }

  for (const sub of data.submissions) {
    const key = String(sub.assignment_id);
    const prev = before.calificaciones.by_assignment[key];
    const hadScore = prev?.score !== null && prev?.score !== undefined;
    const hasScore = sub.score !== null && sub.graded_at;
    if (!prev && hasScore) {
      const course = courseCodeForId(sub.course_id, data.courses);
      const pts = sub.assignment?.points_possible ?? 20;
      items.push({
        tipo: "calificacion",
        curso: course,
        titulo: sub.assignment?.name ?? `Tarea ${sub.assignment_id}`,
        detalle: `${sub.score}/${pts}`,
        url: sub.assignment?.html_url ?? sub.html_url ?? "",
        when: sub.graded_at ?? now,
      });
    } else if (hadScore && hasScore && prev.score !== sub.score) {
      const course = courseCodeForId(sub.course_id, data.courses);
      const pts = sub.assignment?.points_possible ?? 20;
      items.push({
        tipo: "calificacion",
        curso: course,
        titulo: sub.assignment?.name ?? `Tarea ${sub.assignment_id}`,
        detalle: `${prev.score} → ${sub.score}/${pts}`,
        url: sub.assignment?.html_url ?? sub.html_url ?? "",
        when: sub.graded_at ?? now,
      });
    }
  }

  for (const [courseId, mods] of data.modules) {
    const totalItems = mods.reduce((sum, m) => sum + m.items_count, 0);
    const prev = before.modulos.by_course[String(courseId)];
    if (prev && totalItems > prev.items_count) {
      const course = courseCodeForId(courseId, data.courses);
      const newItems = totalItems - prev.items_count;
      items.push({
        tipo: "modulo",
        curso: course,
        titulo: `${newItems} item${newItems > 1 ? "s" : ""} nuevo${newItems > 1 ? "s" : ""}`,
        detalle: `total: ${totalItems}`,
        url: `https://campus.uwiener.edu.pe/courses/${courseId}/modules`,
        when: now,
      });
    }
  }

  items.sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime());
  return items;
}
