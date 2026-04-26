import type { CanvasAnnouncement } from "../../../types/canvas.js";
import { loadCanvasSession } from "../../auth/store.js";
import { CanvasNotConfiguredError } from "../../errors.js";
import { canvasFetchAll } from "./client.js";

async function requireCanvasToken(profile = "default"): Promise<string> {
  const session = await loadCanvasSession(profile);
  if (!session) throw new CanvasNotConfiguredError();
  return session.token;
}

export async function fetchAnnouncements(
  courseIds: number[],
  lastN = 10,
  profile = "default",
): Promise<CanvasAnnouncement[]> {
  if (courseIds.length === 0) return [];

  const token = await requireCanvasToken(profile);
  const contextCodes = courseIds.map((id) => `course_${id}`);
  const params = new URLSearchParams();
  for (const code of contextCodes) params.append("context_codes[]", code);
  params.set("per_page", String(lastN));

  const path = `/api/v1/announcements?${params.toString()}`;
  const res = await canvasFetchAll<CanvasAnnouncement>(path, { token });
  return res.data;
}

export async function getAnnouncements(
  courseIds: number[],
  lastN = 10,
  profile = "default",
): Promise<CanvasAnnouncement[]> {
  return fetchAnnouncements(courseIds, lastN, profile);
}

export async function fetchGlobalAnnouncements(
  accountId: number | "auto" = "auto",
  profile = "default",
): Promise<CanvasAnnouncement[]> {
  const token = await requireCanvasToken(profile);
  const id = accountId === "auto" ? 1 : accountId;
  const params = new URLSearchParams();
  params.append("context_codes[]", `account_${id}`);
  params.set("per_page", "20");

  const path = `/api/v1/announcements?${params.toString()}`;
  const res = await canvasFetchAll<CanvasAnnouncement>(path, { token });
  return res.data;
}
