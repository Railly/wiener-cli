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
