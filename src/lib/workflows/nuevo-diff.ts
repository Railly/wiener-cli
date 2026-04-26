import type { CanvasFileMeta, CanvasModule } from "../../types/canvas.js";
import { getAnnouncements } from "../api/canvas/announcements.js";
import { getActiveCourses } from "../api/canvas/courses.js";
import { listAllFiles } from "../api/canvas/files.js";
import { getModulesWithItems } from "../api/canvas/modules.js";
import { getMySubmissions } from "../api/canvas/submissions.js";
import { getProfileAliases } from "../courses/alias-store.js";
import { generateAliasMapByCodeName } from "../courses/auto-alias.js";
import { groupBySection } from "../courses/grouping.js";
import {
  type CurrentData,
  type DeltaItem,
  buildSnapshotsFromCurrent,
  computeDiff,
} from "../state/diff.js";
import { EMPTY_SNAPSHOTS, loadState, saveState } from "../state/snapshot.js";

export interface NuevoResult {
  desde: string | null;
  items: DeltaItem[];
}

export interface NuevoOpts {
  dryRun?: boolean;
  profile?: string;
}

export async function runNuevo(opts: NuevoOpts = {}): Promise<NuevoResult> {
  const { dryRun = false, profile = "default" } = opts;

  const prevState = loadState(profile);
  const desde = prevState?.last_run_at ?? null;
  const before = prevState?.snapshots ?? EMPTY_SNAPSHOTS;

  const rawCourses = await getActiveCourses(profile);
  const customAliases = getProfileAliases(profile);
  const autoAliases = generateAliasMapByCodeName(
    rawCourses.map((c) => ({ code: c.course_code, name: c.name })),
  );
  const aliasMap = { ...autoAliases, ...customAliases };
  const courses = groupBySection(rawCourses, aliasMap);

  const allCourseIds = courses.flatMap((c) => c.secciones.map((s) => Number(s.id)));

  const [anuncios, submissions, ...perCourse] = await Promise.all([
    getAnnouncements(allCourseIds),
    getMySubmissions(),
    ...allCourseIds.map(async (id) => ({
      courseId: id,
      files: await listAllFiles(id),
      modules: await getModulesWithItems(id),
    })),
  ]);

  const archivosMap = new Map<number, CanvasFileMeta[]>();
  const modulesMap = new Map<number, CanvasModule[]>();
  for (const { courseId, files, modules } of perCourse) {
    archivosMap.set(courseId, files);
    modulesMap.set(courseId, modules);
  }

  const currentData: CurrentData = {
    anuncios,
    archivos: archivosMap,
    submissions,
    modules: modulesMap,
    courses,
  };

  const after = buildSnapshotsFromCurrent(currentData);
  const items = computeDiff(before, after, currentData);

  if (!dryRun) {
    saveState({ last_run_at: new Date().toISOString(), snapshots: after }, profile);
  }

  return { desde, items };
}
