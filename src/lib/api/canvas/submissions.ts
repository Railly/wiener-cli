import type { CanvasSubmission } from "../../../types/canvas.js";
import { canvasFetchAll } from "./client.js";

export async function fetchCourseSubmissions(courseId: number): Promise<CanvasSubmission[]> {
  const res = await canvasFetchAll<CanvasSubmission>(
    `/api/v1/courses/${courseId}/students/submissions`,
    {
      queryParams: {
        "student_ids[]": "self",
        "include[]": "assignment",
        per_page: 100,
      },
    }
  );
  return res.data;
}
