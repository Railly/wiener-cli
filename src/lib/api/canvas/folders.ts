// PHASE C WILL REPLACE — Canvas folders API
import { canvasFetch } from "./client.ts";

export interface CanvasFolder {
  id: number;
  name: string;
  full_name: string;
  parent_folder_id: number | null;
  files_count: number;
  folders_count: number;
}

export async function getFolderTree(courseId: string, token: string): Promise<CanvasFolder[]> {
  const folders: CanvasFolder[] = [];
  let path: string | undefined = `/api/v1/courses/${courseId}/folders?per_page=100`;

  while (path) {
    const res = await canvasFetch<CanvasFolder[]>(path, token);
    folders.push(...res.data);
    path = res.nextLink;
  }

  return folders;
}
