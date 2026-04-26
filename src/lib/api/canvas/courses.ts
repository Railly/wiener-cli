import { DEFAULT_CONFIG } from "../../../types/config.js";
import type { CanvasCourse } from "../../../types/course.js";
import { canvasFetch, canvasFetchAll } from "./client.js";
import { loadCanvasSession } from "../../auth/store.js";
import { getFromCache, setCache } from "../../cache/kv.js";
import { CanvasNotConfiguredError } from "../../errors.js";

export async function getActiveCourses(token: string): Promise<CanvasCourse[]> {
  const result = await canvasFetchAll<CanvasCourse>(
    `/api/v1/courses?enrollment_state=active&per_page=${DEFAULT_CONFIG.canvas.per_page}&include[]=term&include[]=enrollments`,
    { token },
  );
  return result.data;
}

export async function getCourse(token: string, id: string): Promise<CanvasCourse> {
  const { canvasFetch } = await import("./client.js");
  const result = await canvasFetch<CanvasCourse>(
    `/api/v1/courses/${id}?include[]=tabs&include[]=term&include[]=enrollments`,
    { token },
  );
  return result.data;
}

export async function getFavoriteCourses(token: string): Promise<CanvasCourse[]> {
  const result = await canvasFetchAll<CanvasCourse>(
    "/api/v1/users/self/favorites/courses?include[]=term&include[]=enrollments",
    { token },
  );
  return result.data;
}

async function requireCanvasToken(profile = "default"): Promise<string> {
  const session = await loadCanvasSession(profile);
  if (!session) throw new CanvasNotConfiguredError();
  return session.token;
}

export async function fetchActiveCourses(profile = "default"): Promise<CanvasCourse[]> {
  const cacheUrl = "/api/v1/courses?enrollment_state=active";
  const cached = getFromCache<CanvasCourse[]>(cacheUrl);
  if (cached) return cached.value;

  const token = await requireCanvasToken(profile);
  const res = await canvasFetchAll<CanvasCourse>(
    `/api/v1/courses?enrollment_state=active&per_page=${DEFAULT_CONFIG.canvas.per_page}&include[]=term`,
    { token },
  );

  setCache(cacheUrl, res.data);
  return res.data;
}

export async function fetchCourse(
  courseId: number,
  includeSyllabus = false,
  profile = "default",
): Promise<CanvasCourse> {
  const token = await requireCanvasToken(profile);
  const extra = includeSyllabus ? "&include[]=syllabus_body" : "";
  const res = await canvasFetch<CanvasCourse>(
    `/api/v1/courses/${courseId}?include[]=term&include[]=enrollments${extra}`,
    { token },
  );
  return res.data;
}
