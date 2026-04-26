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
    },
  );
  return res.data;
}

export async function getMySubmissions(): Promise<CanvasSubmission[]> {
  const enrollments = await canvasFetchAll<{ course_id: number }>(
    "/api/v1/users/self/enrollments?state=active&per_page=50",
  );
  const courseIds = enrollments.data.map((e) => e.course_id);
  const allSubs = await Promise.all(courseIds.map((id) => fetchCourseSubmissions(id)));
  return allSubs.flat();
}
