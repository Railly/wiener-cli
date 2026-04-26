import { existsSync, statSync } from "node:fs";
import { basename, extname } from "node:path";
import type { AssignmentWithSubmission } from "../../lib/api/canvas/assignments.ts";
import { fetchAssignment, fetchAssignments } from "../../lib/api/canvas/assignments.ts";
import { WienerError } from "../../lib/errors.ts";

export type SubmissionType = "online_upload" | "online_text_entry" | "online_url";

export interface Assignment extends AssignmentWithSubmission {}

export async function resolveAssignment(
  courseId: number,
  assignmentRef: string,
): Promise<Assignment> {
  const numericId = Number.parseInt(assignmentRef, 10);

  if (!Number.isNaN(numericId) && String(numericId) === assignmentRef.trim()) {
    const assignment = await fetchAssignment(courseId, numericId);
    return assignment;
  }

  const all = await fetchAssignments(courseId);
  const lower = assignmentRef.toLowerCase();
  const matches = all.filter((a) => a.name.toLowerCase().includes(lower));

  if (matches.length === 0) {
    throw new WienerError("assignment-not-found", `No assignment matching "${assignmentRef}"`, {
      hint: "Try: wiener tareas <curso> to see all assignments",
      details: { ref: assignmentRef, courseId },
    });
  }

  if (matches.length > 1) {
    throw new WienerError("assignment-ambiguous", `Multiple assignments match "${assignmentRef}"`, {
      hint: "Use a more specific name or the numeric assignment ID",
      details: {
        candidates: matches.map((a) => ({ id: a.id, name: a.name })),
      },
    });
  }

  return matches[0] as Assignment;
}

export function pickSubmissionType(
  assignment: Assignment,
  typeOpt: string | undefined,
): SubmissionType {
  const supported = assignment.submission_types.filter(
    (t): t is SubmissionType =>
      t === "online_upload" || t === "online_text_entry" || t === "online_url",
  );

  if (supported.length === 0) {
    throw new WienerError(
      "validation-error",
      `Assignment "${assignment.name}" does not support online submissions`,
      {
        hint: `Supported types: ${assignment.submission_types.join(", ")}`,
      },
    );
  }

  if (typeOpt && typeOpt !== "auto") {
    const requested = typeOpt as SubmissionType;
    if (!supported.includes(requested)) {
      throw new WienerError(
        "validation-error",
        `Assignment does not support submission type "${requested}"`,
        {
          hint: `Supported: ${supported.join(", ")}`,
        },
      );
    }
    return requested;
  }

  if (supported.length === 1) {
    return supported[0];
  }

  throw new WienerError(
    "validation-error",
    `Assignment supports multiple submission types: ${supported.join(", ")}`,
    {
      hint: "Use --type <online_upload|online_text_entry|online_url> to specify",
      details: { supported },
    },
  );
}

export interface UploadValidation {
  valid: true;
  files: Array<{ path: string; name: string; size: number; sizeHuman: string }>;
}

export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

export function validateUploads(assignment: Assignment, filePaths: string[]): UploadValidation {
  if (filePaths.length === 0) {
    throw new WienerError(
      "validation-error",
      "At least one file is required for online_upload submission",
      { hint: "Example: wiener tareas submit ciencia informe ./informe.pdf" },
    );
  }

  const allowedExtensions = assignment.allowed_extensions ?? [];

  const files: UploadValidation["files"] = [];

  for (const filePath of filePaths) {
    if (!existsSync(filePath)) {
      throw new WienerError("file-not-found", `File not found: ${filePath}`, {
        hint: "Check the path and try again",
      });
    }

    if (allowedExtensions.length > 0) {
      const ext = extname(filePath).replace(".", "").toLowerCase();
      const allowed = allowedExtensions.map((e) => e.toLowerCase());
      if (!allowed.includes(ext)) {
        throw new WienerError(
          "submission-invalid-extension",
          `File extension ".${ext}" not allowed for this assignment`,
          {
            hint: `Allowed extensions: ${allowedExtensions.join(", ")}`,
            details: { ext, allowedExtensions },
          },
        );
      }
    }

    const stat = statSync(filePath);
    const name = basename(filePath);
    files.push({
      path: filePath,
      name,
      size: stat.size,
      sizeHuman: formatFileSize(stat.size),
    });
  }

  return { valid: true, files };
}

export function formatRelativeTime(isoDate: string | null): string {
  if (!isoDate) return "—";
  const now = Date.now();
  const target = new Date(isoDate).getTime();
  const diffMs = target - now;
  const diffMin = Math.round(diffMs / 60_000);

  if (Math.abs(diffMin) < 60) {
    return diffMin >= 0 ? `en ${diffMin}m` : `hace ${-diffMin}m`;
  }

  const diffH = Math.round(diffMs / 3_600_000);
  if (Math.abs(diffH) < 24) {
    return diffH >= 0 ? `en ${diffH}h` : `hace ${-diffH}h`;
  }

  const diffD = Math.round(diffMs / 86_400_000);
  return diffD >= 0 ? `en ${diffD}d` : `hace ${-diffD}d`;
}

export interface SubmitPreviewData {
  courseCode: string;
  courseName: string;
  assignment: Assignment;
  submissionType: SubmissionType;
  files?: UploadValidation["files"];
  textBody?: string;
  url?: string;
  comment?: string;
  isLate: boolean;
  isLastAttempt: boolean;
  alreadySubmitted: boolean;
  currentAttempt: number;
  allowedAttempts: number | null;
}

export function formatPreview(data: SubmitPreviewData): string {
  const lines: string[] = [
    "wiener tareas submit — PREVIEW",
    "─".repeat(40),
    `Curso:        ${data.courseCode} · ${data.courseName}`,
    `Tarea:        ${data.assignment.name}`,
    `Tipo:         ${data.submissionType}`,
  ];

  if (data.files && data.files.length > 0) {
    if (data.files.length === 1) {
      lines.push(`Archivos:     ${data.files[0].name} (${data.files[0].sizeHuman})`);
    } else {
      lines.push(`Archivos:     ${data.files.length} files`);
      for (const f of data.files) {
        lines.push(`              • ${f.name} (${f.sizeHuman})`);
      }
    }
  }

  if (data.textBody) {
    const preview = data.textBody.slice(0, 80) + (data.textBody.length > 80 ? "…" : "");
    lines.push(`Texto:        ${preview}`);
  }

  if (data.url) {
    lines.push(`URL:          ${data.url}`);
  }

  if (data.comment) {
    lines.push(`Comentario:   ${data.comment}`);
  }

  const dueStr = data.assignment.due_at
    ? `${new Date(data.assignment.due_at).toLocaleString("es-PE", {
        dateStyle: "short",
        timeStyle: "short",
      })} (${formatRelativeTime(data.assignment.due_at)})`
    : "sin fecha";
  lines.push(`Vence:        ${dueStr}`);

  const pts =
    data.assignment.points_possible === 0
      ? "0 (formativa)"
      : String(data.assignment.points_possible);
  lines.push(`Puntos:       ${pts}`);

  const attemptsStr =
    data.allowedAttempts !== null && data.allowedAttempts > 0
      ? `${data.currentAttempt + 1} / ${data.allowedAttempts}${
          data.isLastAttempt ? " (ÚLTIMO INTENTO)" : ""
        }`
      : "ilimitado";
  lines.push(`Intentos:     ${attemptsStr}`);

  lines.push("");

  if (data.isLate) {
    lines.push("ADVERTENCIA: La fecha límite ha pasado — esta entrega será tardía.");
  }
  if (data.alreadySubmitted && !data.isLastAttempt) {
    lines.push("ADVERTENCIA: Ya tienes una entrega para esta tarea — será reemplazada.");
  }
  if (data.isLastAttempt) {
    lines.push("ADVERTENCIA: Este es tu ÚLTIMO intento disponible.");
  }

  lines.push("Esto enviará tu trabajo a Canvas. No es reversible.");
  lines.push("Continúa con --yes o cancela con Ctrl+C.");

  return lines.join("\n");
}
