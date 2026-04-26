// PHASE C WILL REPLACE — stub for Phase D
import type { CanvasAnnouncement } from "../../../types/canvas.js";

export async function getAnnouncements(courseIds: number[]): Promise<CanvasAnnouncement[]> {
  if (courseIds.length === 0) return [];
  return [
    {
      id: 9901,
      context_code: "course_131068",
      title: "Cambio de aula sesión jueves",
      message: "<p>El jueves 30 la clase será en Aula 401.</p>",
      posted_at: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
      author: { display_name: "García, Luis" },
      html_url:
        "https://campus.uwiener.edu.pe/courses/131068/discussion_topics/9901",
    },
  ];
}
