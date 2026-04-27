import type { CanvasSubmission } from "../../../types/canvas.js";
import { loadCanvasSession } from "../../auth/store.js";
import { CanvasNotConfiguredError } from "../../errors.js";
import { canvasFetchAll } from "./client.js";

async function requireCanvasToken(profile = "default"): Promise<string> {
  const session = await loadCanvasSession(profile);
  if (!session) throw new CanvasNotConfiguredError();
  return session.token;
}

export async function fetchCourseSubmissions(
  courseId: number,
  profile = "default",
): Promise<CanvasSubmission[]> {
  const token = await requireCanvasToken(profile);
  const res = await canvasFetchAll<CanvasSubmission>(
    `/api/v1/courses/${courseId}/students/submissions?student_ids[]=self&include[]=assignment&per_page=100`,
    { token },
  );
  return res.data;
}

export async function getMySubmissions(profile = "default"): Promise<CanvasSubmission[]> {
  const token = await requireCanvasToken(profile);
  const enrollments = await canvasFetchAll<{ course_id: number }>(
    "/api/v1/users/self/enrollments?state=active&per_page=50",
    { token },
  );
  const courseIds = enrollments.data.map((e) => e.course_id);
  const allSubs = await Promise.all(courseIds.map((id) => fetchCourseSubmissions(id, profile)));
  return allSubs.flat();
}
