import { DEFAULT_CONFIG } from "../../../types/config.js";
import type { CanvasCourse } from "../../../types/course.js";
import { canvasFetchAll } from "./client.js";

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
