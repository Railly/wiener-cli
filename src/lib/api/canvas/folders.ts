import { canvasFetchAll } from "./client.ts";

export interface CanvasFolder {
  id: number;
  name: string;
  full_name: string;
  parent_folder_id: number | null;
  files_count: number;
  folders_count: number;
}

export async function getFolderTree(courseId: string, token: string): Promise<CanvasFolder[]> {
  const res = await canvasFetchAll<CanvasFolder>(
    `/api/v1/courses/${courseId}/folders?per_page=100`,
    { token },
  );
  return res.data;
}
