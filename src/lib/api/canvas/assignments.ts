import type { CanvasAssignment, CanvasSubmission } from "../../../types/canvas.js";
import { getFromCache, setCache } from "../../cache/kv.js";
import { canvasFetch, canvasFetchAll } from "./client.js";

export interface AssignmentWithSubmission extends CanvasAssignment {
  submission?: CanvasSubmission | null;
}

export async function fetchAssignments(
  courseId: number,
  perPage = 100,
): Promise<AssignmentWithSubmission[]> {
  const cacheUrl = `/api/v1/courses/${courseId}/assignments?per_page=${perPage}`;
  const cached = getFromCache<AssignmentWithSubmission[]>(cacheUrl);
  if (cached) return cached.value;

  const res = await canvasFetchAll<AssignmentWithSubmission>(
    `/api/v1/courses/${courseId}/assignments`,
    {
      queryParams: {
        per_page: perPage,
        include: "submission",
      },
    },
  );

  setCache(cacheUrl, res.data);
  return res.data;
}

export async function fetchAssignment(
  courseId: number,
  assignmentId: number,
): Promise<AssignmentWithSubmission> {
  const res = await canvasFetch<AssignmentWithSubmission>(
    `/api/v1/courses/${courseId}/assignments/${assignmentId}`,
    {
      queryParams: {
        "include[]": "submission",
        "include[overrides]": true,
      },
    },
  );
  return res.data;
}
