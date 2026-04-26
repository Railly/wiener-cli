import type { CanvasConference } from "../../../types/canvas.js";
import { loadCanvasSession } from "../../auth/store.js";
import { CanvasNotConfiguredError } from "../../errors.js";
import { canvasFetchAll } from "./client.js";

async function requireCanvasToken(profile = "default"): Promise<string> {
  const session = await loadCanvasSession(profile);
  if (!session) throw new CanvasNotConfiguredError();
  return session.token;
}

export async function fetchConferences(courseId: number, profile = "default"): Promise<CanvasConference[]> {
  const token = await requireCanvasToken(profile);
  const res = await canvasFetchAll<CanvasConference>(
    `/api/v1/courses/${courseId}/conferences`,
    { token },
  );
  return res.data;
}
