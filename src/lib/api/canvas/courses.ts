import type { CanvasCourse } from "../../../types/canvas.js";
import { canvasFetch, canvasFetchAll } from "./client.js";
import { getFromCache, setCache } from "../../cache/kv.js";

export async function fetchActiveCourses(): Promise<CanvasCourse[]> {
  const cacheUrl = "/api/v1/courses?enrollment_state=active";
  const cached = getFromCache<CanvasCourse[]>(cacheUrl);
  if (cached) return cached.value;

  const res = await canvasFetchAll<CanvasCourse>("/api/v1/courses", {
    queryParams: {
      enrollment_state: "active",
      "include[]": "term",
      per_page: 100,
    },
  });

  setCache(cacheUrl, res.data);
  return res.data;
}

export async function fetchCourse(courseId: number, includeSyllabus = false): Promise<CanvasCourse> {
  const queryParams: Record<string, string | boolean | undefined> = {};
  if (includeSyllabus) queryParams["include[]"] = "syllabus_body";

  const res = await canvasFetch<CanvasCourse>(`/api/v1/courses/${courseId}`, { queryParams });
  return res.data;
}
