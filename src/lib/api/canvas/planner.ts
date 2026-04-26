import type { CanvasPlannerItem } from "../../../types/canvas.js";
import { loadCanvasSession } from "../../auth/store.js";
import { CanvasNotConfiguredError } from "../../errors.js";
import { canvasFetchAll } from "./client.js";

async function requireCanvasToken(profile = "default"): Promise<string> {
  const session = await loadCanvasSession(profile);
  if (!session) throw new CanvasNotConfiguredError();
  return session.token;
}

export async function fetchPlannerItems(opts?: {
  startDate?: string;
  endDate?: string;
  perPage?: number;
  contextCodes?: string[];
  profile?: string;
}): Promise<CanvasPlannerItem[]> {
  const token = await requireCanvasToken(opts?.profile ?? "default");

  const params = new URLSearchParams({ per_page: String(opts?.perPage ?? 50) });
  if (opts?.startDate) params.set("start_date", opts.startDate);
  if (opts?.endDate) params.set("end_date", opts.endDate);
  if (opts?.contextCodes?.length) {
    for (const c of opts.contextCodes) params.append("context_codes[]", c);
  }

  const path = `/api/v1/planner/items?${params.toString()}`;
  const res = await canvasFetchAll<CanvasPlannerItem>(path, { token });
  return res.data;
}
