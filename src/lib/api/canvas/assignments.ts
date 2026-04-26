import type { CanvasAssignment, CanvasSubmission } from "../../../types/canvas.js";
import { loadCanvasSession } from "../../auth/store.js";
import { getFromCache, setCache } from "../../cache/kv.js";
import { CanvasNotConfiguredError } from "../../errors.js";
import { canvasFetch, canvasFetchAll } from "./client.js";

async function requireCanvasToken(profile = "default"): Promise<string> {
  const session = await loadCanvasSession(profile);
  if (!session) throw new CanvasNotConfiguredError();
  return session.token;
}

export interface AssignmentWithSubmission extends CanvasAssignment {
  submission?: CanvasSubmission | null;
}

export async function fetchAssignments(
  courseId: number,
  perPage = 100,
  profile = "default",
): Promise<AssignmentWithSubmission[]> {
  const cacheUrl = `/api/v1/courses/${courseId}/assignments?per_page=${perPage}`;
  const cached = getFromCache<AssignmentWithSubmission[]>(cacheUrl);
  if (cached) return cached.value;

  const token = await requireCanvasToken(profile);
  const params = new URLSearchParams({
    per_page: String(perPage),
    "include[]": "submission",
  });
  const res = await canvasFetchAll<AssignmentWithSubmission>(
    `/api/v1/courses/${courseId}/assignments?${params.toString()}`,
    { token },
  );

  setCache(cacheUrl, res.data);
  return res.data;
}

export async function fetchAssignment(
  courseId: number,
  assignmentId: number,
  profile = "default",
): Promise<AssignmentWithSubmission> {
  const token = await requireCanvasToken(profile);
  const res = await canvasFetch<AssignmentWithSubmission>(
    `/api/v1/courses/${courseId}/assignments/${assignmentId}?include[]=submission&include[overrides]=true`,
    { token },
  );
  return res.data;
}
