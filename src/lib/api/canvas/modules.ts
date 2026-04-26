import type { CanvasModule } from "../../../types/canvas.js";
import { canvasFetchAll } from "./client.js";

export async function fetchModules(courseId: number): Promise<CanvasModule[]> {
  const res = await canvasFetchAll<CanvasModule>(`/api/v1/courses/${courseId}/modules`, {
    queryParams: {
      "include[]": "items",
      per_page: 50,
    },
  });
  return res.data;
}

export const getModulesWithItems = fetchModules;
