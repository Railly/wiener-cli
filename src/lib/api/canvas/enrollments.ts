import type { CanvasEnrollment } from "../../../types/canvas.js";
import { loadCanvasSession } from "../../auth/store.js";
import { getFromCache, setCache } from "../../cache/kv.js";
import { CanvasNotConfiguredError } from "../../errors.js";
import { canvasFetchAll } from "./client.js";

async function requireCanvasToken(profile = "default"): Promise<string> {
  const session = await loadCanvasSession(profile);
  if (!session) throw new CanvasNotConfiguredError();
  return session.token;
}

export async function fetchStudentEnrollments(profile = "default"): Promise<CanvasEnrollment[]> {
  const cacheUrl = "/api/v1/users/self/enrollments?student";
  const cached = getFromCache<CanvasEnrollment[]>(cacheUrl);
  if (cached) return cached.value;

  const token = await requireCanvasToken(profile);
  const res = await canvasFetchAll<CanvasEnrollment>(
    "/api/v1/users/self/enrollments?type[]=StudentEnrollment&include[]=current_grade&per_page=100",
    { token },
  );

  setCache(cacheUrl, res.data);
  return res.data;
}
