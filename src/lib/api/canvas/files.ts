import type { CanvasFile, CanvasFolder } from "../../../types/canvas.js";
import { canvasFetchAll } from "./client.js";

export async function fetchCourseFiles(courseId: number): Promise<CanvasFile[]> {
  const res = await canvasFetchAll<CanvasFile>(`/api/v1/courses/${courseId}/files`, {
    queryParams: { per_page: 100 },
  });
  return res.data;
}

export async function fetchCourseFolders(courseId: number): Promise<CanvasFolder[]> {
  const res = await canvasFetchAll<CanvasFolder>(`/api/v1/courses/${courseId}/folders`, {
    queryParams: { per_page: 100 },
  });
  return res.data;
}

export async function fetchFolderFiles(folderId: number): Promise<CanvasFile[]> {
  const res = await canvasFetchAll<CanvasFile>(`/api/v1/folders/${folderId}/files`, {
    queryParams: { per_page: 100 },
  });
  return res.data;
}

export async function fetchFolderSubFolders(folderId: number): Promise<CanvasFolder[]> {
  const res = await canvasFetchAll<CanvasFolder>(`/api/v1/folders/${folderId}/folders`, {
    queryParams: { per_page: 100 },
  });
  return res.data;
}

export interface FileTreeNode {
  folder: CanvasFolder;
  files: CanvasFile[];
  subfolders: FileTreeNode[];
}

export async function listAllFiles(courseId: number): Promise<CanvasFile[]> {
  return fetchCourseFiles(courseId);
}

export async function buildFileTree(courseId: number): Promise<FileTreeNode | null> {
  const allFolders = await fetchCourseFolders(courseId);
  if (allFolders.length === 0) return null;

  const folderMap = new Map<number, CanvasFolder>();
  for (const f of allFolders) folderMap.set(f.id, f);

  const childrenOf = new Map<number | null, CanvasFolder[]>();
  for (const f of allFolders) {
    const parent = f.parent_folder_id ?? null;
    const children = childrenOf.get(parent) ?? [];
    children.push(f);
    childrenOf.set(parent, children);
  }

  const root = allFolders.find((f) => !f.parent_folder_id);
  if (!root) return null;

  async function buildNode(folder: CanvasFolder): Promise<FileTreeNode> {
    const [files, subFolderObjects] = await Promise.all([
      fetchFolderFiles(folder.id),
      Promise.resolve(childrenOf.get(folder.id) ?? []),
    ]);
    const subfolders = await Promise.all(subFolderObjects.map(buildNode));
    return { folder, files, subfolders };
  }

  return buildNode(root);
}
