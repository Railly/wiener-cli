import type { CanvasPage } from "../../../types/canvas.js";
import { loadCanvasSession } from "../../auth/store.js";
import { CanvasNotConfiguredError } from "../../errors.js";
import { canvasFetch, canvasFetchAll } from "./client.js";

async function requireCanvasToken(profile = "default"): Promise<string> {
  const session = await loadCanvasSession(profile);
  if (!session) throw new CanvasNotConfiguredError();
  return session.token;
}

export async function fetchPages(courseId: number, profile = "default"): Promise<CanvasPage[]> {
  const token = await requireCanvasToken(profile);
  const res = await canvasFetchAll<CanvasPage>(
    `/api/v1/courses/${courseId}/pages?per_page=50`,
    { token },
  );
  return res.data;
}

export async function fetchPage(courseId: number, pageUrl: string, profile = "default"): Promise<CanvasPage> {
  const token = await requireCanvasToken(profile);
  const res = await canvasFetch<CanvasPage>(
    `/api/v1/courses/${courseId}/pages/${pageUrl}`,
    { token },
  );
  return res.data;
}
