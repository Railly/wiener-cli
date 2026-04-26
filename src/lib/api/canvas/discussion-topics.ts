import type { CanvasDiscussion } from "../../../types/canvas.js";
import { loadCanvasSession } from "../../auth/store.js";
import { CanvasNotConfiguredError } from "../../errors.js";
import { canvasFetchAll } from "./client.js";

async function requireCanvasToken(profile = "default"): Promise<string> {
  const session = await loadCanvasSession(profile);
  if (!session) throw new CanvasNotConfiguredError();
  return session.token;
}

export async function fetchDiscussions(courseId: number, profile = "default"): Promise<CanvasDiscussion[]> {
  const token = await requireCanvasToken(profile);
  const res = await canvasFetchAll<CanvasDiscussion>(
    `/api/v1/courses/${courseId}/discussion_topics?per_page=50`,
    { token },
  );
  return res.data;
}
