import type { CanvasModule } from "../../../types/canvas.js";
import { loadCanvasSession } from "../../auth/store.js";
import { CanvasNotConfiguredError } from "../../errors.js";
import { canvasFetchAll } from "./client.js";

async function requireCanvasToken(profile = "default"): Promise<string> {
  const session = await loadCanvasSession(profile);
  if (!session) throw new CanvasNotConfiguredError();
  return session.token;
}

export async function fetchModules(courseId: number, profile = "default"): Promise<CanvasModule[]> {
  const token = await requireCanvasToken(profile);
  const res = await canvasFetchAll<CanvasModule>(
    `/api/v1/courses/${courseId}/modules?include[]=items&per_page=50`,
    { token },
  );
  return res.data;
}

export const getModulesWithItems = fetchModules;

export interface ModuleFileItem {
  id: number;
  title: string;
  url: string;
  module_id: number;
  module_name: string;
  content_id?: number;
}

export async function fetchModuleFileItems(
  courseId: number,
  profile = "default",
): Promise<ModuleFileItem[]> {
  const modules = await fetchModules(courseId, profile);
  const result: ModuleFileItem[] = [];
  for (const mod of modules) {
    const items = mod.items ?? [];
    for (const item of items) {
      if (item.type === "File" && item.url) {
        result.push({
          id: item.id,
          title: item.title,
          url: item.url,
          module_id: mod.id,
          module_name: mod.name,
          content_id: item.content_id,
        });
      }
    }
  }
  return result;
}
