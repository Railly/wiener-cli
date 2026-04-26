import type { CanvasConference } from "../../../types/canvas.js";
import { canvasFetchAll } from "./client.js";

export async function fetchConferences(courseId: number): Promise<CanvasConference[]> {
  const res = await canvasFetchAll<CanvasConference>(
    `/api/v1/courses/${courseId}/conferences`
  );
  return res.data;
}
