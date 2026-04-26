// PHASE C WILL REPLACE — stub for Phase D
import type { CanvasModule } from "../../../types/canvas.js";

export async function getModulesWithItems(courseId: number): Promise<CanvasModule[]> {
  if (courseId === 131067) {
    return [
      {
        id: 7001,
        name: "Semana 1 — Introducción",
        items_count: 5,
        items: [
          {
            id: 70011,
            title: "Syllabus",
            type: "Page",
            html_url:
              "https://campus.uwiener.edu.pe/courses/131067/pages/syllabus",
          },
        ],
      },
      {
        id: 7002,
        name: "Semana 2 — Métodos",
        items_count: 4,
        items: [],
      },
    ];
  }
  return [];
}
