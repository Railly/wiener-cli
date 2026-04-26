import type { CanvasAnnouncement } from "../../../types/canvas.js";
import { canvasFetchAll } from "./client.js";

export async function fetchAnnouncements(
  courseIds: number[],
  lastN = 10,
): Promise<CanvasAnnouncement[]> {
  if (courseIds.length === 0) return [];

  const contextCodes = courseIds.map((id) => `course_${id}`);
  const params = new URLSearchParams();
  for (const code of contextCodes) params.append("context_codes[]", code);
  params.set("per_page", String(lastN));

  const path = `/api/v1/announcements?${params.toString()}`;
  const res = await canvasFetchAll<CanvasAnnouncement>(path);
  return res.data;
}

export async function getAnnouncements(
  courseIds: number[],
  lastN = 10,
): Promise<CanvasAnnouncement[]> {
  return fetchAnnouncements(courseIds, lastN);
}

export async function fetchGlobalAnnouncements(
  accountId: number | "auto" = "auto",
): Promise<CanvasAnnouncement[]> {
  const id = accountId === "auto" ? 1 : accountId;
  const params = new URLSearchParams();
  params.append("context_codes[]", `account_${id}`);
  params.set("per_page", "20");

  const path = `/api/v1/announcements?${params.toString()}`;
  const res = await canvasFetchAll<CanvasAnnouncement>(path);
  return res.data;
}
