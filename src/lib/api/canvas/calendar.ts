import type {
  CanvasCalendarEvent,
  CanvasTodoItem,
  CanvasUpcomingEvent,
} from "../../../types/canvas.js";
import { canvasFetchAll } from "./client.js";

export async function fetchUpcomingEvents(): Promise<CanvasUpcomingEvent[]> {
  const res = await canvasFetchAll<CanvasUpcomingEvent>("/api/v1/users/self/upcoming_events");
  return res.data;
}

export async function fetchTodoItems(): Promise<CanvasTodoItem[]> {
  const res = await canvasFetchAll<CanvasTodoItem>("/api/v1/users/self/todo");
  return res.data;
}

export const getUpcomingEvents = fetchUpcomingEvents;
export const getTodo = fetchTodoItems;

export async function fetchCalendarEvents(opts: {
  contextCodes: string[];
  startDate: string;
  endDate: string;
  perPage?: number;
}): Promise<CanvasCalendarEvent[]> {
  const params = new URLSearchParams();
  for (const code of opts.contextCodes) params.append("context_codes[]", code);
  params.set("start_date", opts.startDate);
  params.set("end_date", opts.endDate);
  params.set("per_page", String(opts.perPage ?? 100));

  const path = `/api/v1/calendar_events?${params.toString()}`;
  const res = await canvasFetchAll<CanvasCalendarEvent>(path);
  return res.data;
}
