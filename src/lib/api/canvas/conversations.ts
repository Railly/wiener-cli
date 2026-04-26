import type { CanvasConversation } from "../../../types/canvas.js";
import { canvasFetch, canvasFetchAll } from "./client.js";

export async function fetchConversations(opts?: {
  unreadOnly?: boolean;
  perPage?: number;
}): Promise<CanvasConversation[]> {
  const queryParams: Record<string, string | number | boolean | undefined> = {
    per_page: opts?.perPage ?? 50,
  };
  if (opts?.unreadOnly) queryParams.scope = "unread";

  const res = await canvasFetchAll<CanvasConversation>("/api/v1/conversations", { queryParams });
  return res.data;
}

export async function fetchConversation(id: number): Promise<CanvasConversation> {
  const res = await canvasFetch<CanvasConversation>(`/api/v1/conversations/${id}`);
  return res.data;
}
