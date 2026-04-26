import type { CanvasEnrollment } from "../../../types/canvas.js";
import { canvasFetchAll } from "./client.js";
import { getFromCache, setCache } from "../../cache/kv.js";

export async function fetchStudentEnrollments(): Promise<CanvasEnrollment[]> {
  const cacheUrl = "/api/v1/users/self/enrollments?student";
  const cached = getFromCache<CanvasEnrollment[]>(cacheUrl);
  if (cached) return cached.value;

  const res = await canvasFetchAll<CanvasEnrollment>("/api/v1/users/self/enrollments", {
    queryParams: {
      "type[]": "StudentEnrollment",
      "include[]": "current_grade",
      per_page: 100,
    },
  });

  setCache(cacheUrl, res.data);
  return res.data;
}
