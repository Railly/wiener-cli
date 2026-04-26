import type { CanvasPage } from "../../../types/canvas.js";
import { canvasFetch, canvasFetchAll } from "./client.js";

export async function fetchPages(courseId: number): Promise<CanvasPage[]> {
  const res = await canvasFetchAll<CanvasPage>(`/api/v1/courses/${courseId}/pages`, {
    queryParams: { per_page: 50 },
  });
  return res.data;
}

export async function fetchPage(courseId: number, pageUrl: string): Promise<CanvasPage> {
  const res = await canvasFetch<CanvasPage>(`/api/v1/courses/${courseId}/pages/${pageUrl}`);
  return res.data;
}
