import type { CanvasAssignment, CanvasSubmission } from "../../../types/canvas.js";
import { loadCanvasSession } from "../../auth/store.js";
import { getFromCache, setCache } from "../../cache/kv.js";
import { CanvasNotConfiguredError, CanvasServerError, is5xxError } from "../../errors.js";
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

function buildAssignmentPath(courseId: number, assignmentId: number, includes: string[]): string {
  const base = `/api/v1/courses/${courseId}/assignments/${assignmentId}`;
  if (includes.length === 0) return base;
  const params = includes.map((i) => `include[]=${encodeURIComponent(i)}`).join("&");
  return `${base}?${params}`;
}

export async function getAssignment(
  courseId: number,
  assignmentId: number,
  opts?: { includes?: string[]; profile?: string },
): Promise<AssignmentWithSubmission> {
  const token = await requireCanvasToken(opts?.profile ?? "default");
  const includes = opts?.includes ?? ["submission", "overrides"];

  try {
    const res = await canvasFetch<AssignmentWithSubmission>(
      buildAssignmentPath(courseId, assignmentId, includes),
      { token },
    );
    return res.data;
  } catch (e) {
    if (is5xxError(e) && includes.length > 0) {
      for (let i = includes.length - 1; i >= 0; i--) {
        const reduced = includes.slice(0, i);
        try {
          const res = await canvasFetch<AssignmentWithSubmission>(
            buildAssignmentPath(courseId, assignmentId, reduced),
            { token },
          );
          return res.data;
        } catch (e2) {
          if (!is5xxError(e2)) throw e2;
        }
      }
    }
    throw e;
  }
}

export async function fetchAssignment(
  courseId: number,
  assignmentId: number,
  profile = "default",
): Promise<AssignmentWithSubmission> {
  return getAssignment(courseId, assignmentId, {
    includes: ["submission", "overrides"],
    profile,
  });
}
