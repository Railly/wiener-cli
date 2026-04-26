import type { CanvasConversation } from "../../../types/canvas.js";
import { loadCanvasSession } from "../../auth/store.js";
import { CanvasNotConfiguredError } from "../../errors.js";
import { canvasFetch, canvasFetchAll } from "./client.js";

async function requireToken(profile = "default"): Promise<string> {
  const session = await loadCanvasSession(profile);
  if (!session) throw new CanvasNotConfiguredError();
  return session.token;
}

export async function fetchConversations(opts?: {
  unreadOnly?: boolean;
  perPage?: number;
  profile?: string;
}): Promise<CanvasConversation[]> {
  const token = await requireToken(opts?.profile ?? "default");
  const params = new URLSearchParams({ per_page: String(opts?.perPage ?? 50) });
  if (opts?.unreadOnly) params.set("scope", "unread");

  const res = await canvasFetchAll<CanvasConversation>(
    `/api/v1/conversations?${params.toString()}`,
    { token },
  );
  return res.data;
}

export async function fetchConversation(id: number, profile = "default"): Promise<CanvasConversation> {
  const token = await requireToken(profile);
  const res = await canvasFetch<CanvasConversation>(`/api/v1/conversations/${id}`, { token });
  return res.data;
}
