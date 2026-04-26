import { readFileSync, statSync } from "node:fs";
import { basename, extname } from "node:path";
import type {
  CanvasSubmissionResponse,
  CanvasUploadParams,
  CanvasUploadedFile,
} from "../../../types/canvas.ts";
import { NetworkError } from "../../errors.ts";
import { canvasFetch } from "./client.ts";

export type SubmissionPayload =
  | { type: "online_upload"; file_ids: number[] }
  | { type: "online_text_entry"; body: string }
  | { type: "online_url"; url: string };

function getMimeType(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  const mimeMap: Record<string, string> = {
    ".pdf": "application/pdf",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".ppt": "application/vnd.ms-powerpoint",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".txt": "text/plain",
    ".csv": "text/csv",
    ".zip": "application/zip",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".mp4": "video/mp4",
    ".mp3": "audio/mpeg",
  };
  return mimeMap[ext] ?? "application/octet-stream";
}

export async function prepareUpload(
  courseId: number,
  assignmentId: number,
  fileMeta: { name: string; size: number; contentType: string },
  token: string,
): Promise<CanvasUploadParams> {
  const res = await canvasFetch<CanvasUploadParams>(
    `/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/self/files`,
    {
      token,
      method: "POST",
      body: JSON.stringify({
        name: fileMeta.name,
        size: fileMeta.size,
        content_type: fileMeta.contentType,
        parent_folder_path: "/",
      }),
    },
  );
  return res.data;
}

export async function uploadFile(
  uploadUrl: string,
  uploadParams: Record<string, string>,
  fileBuffer: Buffer,
  fileName: string,
  contentType: string,
): Promise<CanvasUploadedFile> {
  const form = new FormData();

  for (const [key, value] of Object.entries(uploadParams)) {
    form.append(key, value);
  }

  const blob = new Blob([fileBuffer], { type: contentType });
  form.append("file", blob, fileName);

  let response: Response;
  try {
    response = await fetch(uploadUrl, {
      method: "POST",
      body: form,
      redirect: "follow",
      signal: AbortSignal.timeout(120_000),
    });
  } catch (cause) {
    throw new NetworkError(`File upload request failed: ${uploadUrl}`, cause);
  }

  if (!response.ok) {
    throw new NetworkError(
      `File upload failed: HTTP ${response.status}`,
      await response.text().catch(() => ""),
    );
  }

  const text = await response.text();
  let data: CanvasUploadedFile;
  try {
    data = JSON.parse(text) as CanvasUploadedFile;
  } catch {
    throw new NetworkError(
      `Canvas upload returned non-JSON (status ${response.status})`,
      text.slice(0, 200),
    );
  }

  return data;
}

export async function uploadAssignmentFile(
  courseId: number,
  assignmentId: number,
  filePath: string,
  token: string,
): Promise<{ id: number; name: string }> {
  const fileName = basename(filePath);
  const fileBuffer = readFileSync(filePath);
  const fileSize = statSync(filePath).size;
  const contentType = getMimeType(filePath);

  const uploadParams = await prepareUpload(
    courseId,
    assignmentId,
    { name: fileName, size: fileSize, contentType },
    token,
  );

  const uploaded = await uploadFile(
    uploadParams.upload_url,
    uploadParams.upload_params,
    fileBuffer,
    fileName,
    contentType,
  );

  return { id: uploaded.id, name: uploaded.display_name ?? fileName };
}

export async function submitAssignment(
  courseId: number,
  assignmentId: number,
  payload: SubmissionPayload,
  token: string,
  comment?: string,
): Promise<CanvasSubmissionResponse> {
  let submissionBody: Record<string, unknown>;

  if (payload.type === "online_upload") {
    submissionBody = {
      submission_type: "online_upload",
      file_ids: payload.file_ids,
    };
  } else if (payload.type === "online_text_entry") {
    submissionBody = {
      submission_type: "online_text_entry",
      body: payload.body,
    };
  } else {
    submissionBody = {
      submission_type: "online_url",
      url: payload.url,
    };
  }

  const requestBody: Record<string, unknown> = { submission: submissionBody };

  if (comment) {
    requestBody.comment = { text_comment: comment };
  }

  const res = await canvasFetch<CanvasSubmissionResponse>(
    `/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions`,
    {
      token,
      method: "POST",
      body: JSON.stringify(requestBody),
    },
  );

  return res.data;
}
