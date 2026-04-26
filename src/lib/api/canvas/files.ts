// PHASE C WILL REPLACE — stub for Phase D
import type { CanvasFileMeta } from "../../../types/canvas.js";

export async function listAllFiles(courseId: number): Promise<CanvasFileMeta[]> {
  if (courseId === 131071) {
    return [
      {
        id: 55001,
        filename: "Tema-04-farmacocinetica.pdf",
        display_name: "Tema-04-farmacocinetica.pdf",
        size: 12_582_912,
        content_type: "application/pdf",
        updated_at: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
        url: "https://campus.uwiener.edu.pe/files/55001/download",
        folder_id: 8001,
      },
    ];
  }
  return [];
}
