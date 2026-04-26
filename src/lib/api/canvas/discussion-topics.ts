import type { CanvasDiscussion } from "../../../types/canvas.js";
import { canvasFetchAll } from "./client.js";

export async function fetchDiscussions(courseId: number): Promise<CanvasDiscussion[]> {
  const res = await canvasFetchAll<CanvasDiscussion>(
    `/api/v1/courses/${courseId}/discussion_topics`,
    { queryParams: { per_page: 50 } }
  );
  return res.data;
}
