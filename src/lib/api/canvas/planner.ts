import type { CanvasPlannerItem } from "../../../types/canvas.js";
import { canvasFetchAll } from "./client.js";

export async function fetchPlannerItems(opts?: {
  startDate?: string;
  endDate?: string;
  perPage?: number;
  contextCodes?: string[];
}): Promise<CanvasPlannerItem[]> {
  const queryParams: Record<string, string | number | boolean | undefined> = {
    per_page: opts?.perPage ?? 50,
  };
  if (opts?.startDate) queryParams["start_date"] = opts.startDate;
  if (opts?.endDate) queryParams["end_date"] = opts.endDate;

  let path = "/api/v1/planner/items";
  if (opts?.contextCodes?.length) {
    const codes = opts.contextCodes.map((c) => `context_codes[]=${encodeURIComponent(c)}`).join("&");
    path += `?${codes}`;
  }

  const res = await canvasFetchAll<CanvasPlannerItem>(path, { queryParams });
  return res.data;
}
