import type {
  CanvasCalendarEvent,
  CanvasTodoItem,
  CanvasUpcomingEvent,
} from "../../../types/canvas.js";
import { loadCanvasSession } from "../../auth/store.js";
import { CanvasNotConfiguredError } from "../../errors.js";
import { canvasFetchAll } from "./client.js";

async function requireToken(profile = "default"): Promise<string> {
  const session = await loadCanvasSession(profile);
  if (!session) throw new CanvasNotConfiguredError();
  return session.token;
}

export async function fetchUpcomingEvents(profile = "default"): Promise<CanvasUpcomingEvent[]> {
  const token = await requireToken(profile);
  const res = await canvasFetchAll<CanvasUpcomingEvent>("/api/v1/users/self/upcoming_events", { token });
  return res.data;
}

export async function fetchTodoItems(profile = "default"): Promise<CanvasTodoItem[]> {
  const token = await requireToken(profile);
  const res = await canvasFetchAll<CanvasTodoItem>("/api/v1/users/self/todo", { token });
  return res.data;
}

export const getUpcomingEvents = fetchUpcomingEvents;
export const getTodo = fetchTodoItems;

export async function fetchCalendarEvents(opts: {
  contextCodes: string[];
  startDate: string;
  endDate: string;
  perPage?: number;
  profile?: string;
}): Promise<CanvasCalendarEvent[]> {
  const token = await requireToken(opts.profile);
  const params = new URLSearchParams();
  for (const code of opts.contextCodes) params.append("context_codes[]", code);
  params.set("start_date", opts.startDate);
  params.set("end_date", opts.endDate);
  params.set("per_page", String(opts.perPage ?? 100));

  const path = `/api/v1/calendar_events?${params.toString()}`;
  const res = await canvasFetchAll<CanvasCalendarEvent>(path, { token });
  return res.data;
}
