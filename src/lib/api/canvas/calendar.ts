// PHASE C WILL REPLACE — stub for Phase D
import type { UpcomingEvent, TodoItem } from "../../../types/canvas.js";

export async function getUpcomingEvents(): Promise<UpcomingEvent[]> {
  const now = new Date();
  const today23 = new Date(now);
  today23.setHours(23, 0, 0, 0);
  const today2359 = new Date(now);
  today2359.setHours(23, 59, 0, 0);
  const tomorrow8 = new Date(now);
  tomorrow8.setDate(tomorrow8.getDate() + 1);
  tomorrow8.setHours(8, 0, 0, 0);
  return [
    {
      type: "assignment",
      title: "Informe semanal UD2",
      html_url: "https://campus.uwiener.edu.pe/courses/131071/assignments/964446",
      start_at: today23.toISOString(),
      assignment: {
        id: 964446,
        course_id: 131071,
        due_at: today23.toISOString(),
        name: "Informe semanal UD2",
        submission_types: ["online_upload"],
      },
      context_code: "course_131071",
    },
    {
      type: "assignment",
      title: "Foro: ética científica",
      html_url: "https://campus.uwiener.edu.pe/courses/131067/assignments/964447",
      start_at: today2359.toISOString(),
      assignment: {
        id: 964447,
        course_id: 131067,
        due_at: today2359.toISOString(),
        name: "Foro: ética científica",
        submission_types: ["discussion_topic"],
      },
      context_code: "course_131067",
    },
    {
      type: "quiz",
      title: "Autoevaluación módulo 3",
      html_url: "https://campus.uwiener.edu.pe/courses/131072/quizzes/12345",
      start_at: tomorrow8.toISOString(),
      context_code: "course_131072",
    },
  ];
}

export async function getTodo(): Promise<TodoItem[]> {
  return [];
}
