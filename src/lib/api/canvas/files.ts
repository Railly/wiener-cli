import type { CanvasFile, CanvasFolder } from "../../../types/canvas.js";
import { loadCanvasSession } from "../../auth/store.js";
import { CanvasNotConfiguredError } from "../../errors.js";
import { canvasFetch, canvasFetchAll } from "./client.js";

async function requireCanvasToken(profile = "default"): Promise<string> {
  const session = await loadCanvasSession(profile);
  if (!session) throw new CanvasNotConfiguredError();
  return session.token;
}

export async function fetchCourseFiles(courseId: number, token: string): Promise<CanvasFile[]> {
  const res = await canvasFetchAll<CanvasFile>(`/api/v1/courses/${courseId}/files?per_page=100`, {
    token,
  });
  return res.data;
}

export async function fetchCourseFolders(courseId: number, token: string): Promise<CanvasFolder[]> {
  const res = await canvasFetchAll<CanvasFolder>(
    `/api/v1/courses/${courseId}/folders?per_page=100`,
    { token },
  );
  return res.data;
}

export async function fetchFolderFiles(folderId: number, token: string): Promise<CanvasFile[]> {
  const res = await canvasFetchAll<CanvasFile>(`/api/v1/folders/${folderId}/files?per_page=100`, {
    token,
  });
  return res.data;
}

export async function fetchFolderSubFolders(
  folderId: number,
  token: string,
): Promise<CanvasFolder[]> {
  const res = await canvasFetchAll<CanvasFolder>(
    `/api/v1/folders/${folderId}/folders?per_page=100`,
    { token },
  );
  return res.data;
}

export interface FileTreeNode {
  folder: CanvasFolder;
  files: CanvasFile[];
  subfolders: FileTreeNode[];
}

export async function listAllFiles(
  courseId: number | string,
  tokenOrProfile?: string,
): Promise<CanvasFile[]> {
  const token =
    tokenOrProfile && tokenOrProfile.length > 20
      ? tokenOrProfile
      : await requireCanvasToken(tokenOrProfile ?? "default");
  const res = await canvasFetchAll<CanvasFile>(`/api/v1/courses/${courseId}/files?per_page=100`, {
    token,
  });
  return res.data;
}

export async function getFile(fileId: string | number, token: string): Promise<CanvasFile> {
  const res = await canvasFetch<CanvasFile>(`/api/v1/files/${fileId}`, { token });
  return res.data;
}

export async function buildFileTree(
  courseId: number,
  profile = "default",
): Promise<FileTreeNode | null> {
  const token = await requireCanvasToken(profile);
  const allFolders = await fetchCourseFolders(courseId, token);
  if (allFolders.length === 0) return null;

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
      fetchFolderFiles(folder.id, token),
      Promise.resolve(childrenOf.get(folder.id) ?? []),
    ]);
    const subfolders = await Promise.all(subFolderObjects.map(buildNode));
    return { folder, files, subfolders };
  }

  return buildNode(root);
}
