import type { CanvasSubmission } from "../../types/canvas.js";

export type SubmissionStatus = "pendiente" | "entregado" | "calificado" | "atrasado";

export interface StatusResult {
  status: SubmissionStatus;
  grade: string | null;
  score: number | null;
  late: boolean;
  submitted: boolean;
  graded: boolean;
  label: string;
}

export function getSubmissionStatus(submission?: CanvasSubmission | null): StatusResult {
  if (!submission || submission.workflow_state === "unsubmitted") {
    return {
      status: "pendiente",
      grade: null,
      score: null,
      late: false,
      submitted: false,
      graded: false,
      label: "pendiente",
    };
  }

  const late = submission.late === true;
  const graded =
    submission.workflow_state === "graded" ||
    (submission.workflow_state === "submitted" && submission.score != null);

  const submitted = submission.workflow_state !== "unsubmitted";

  let status: SubmissionStatus;
  let label: string;

  if (graded) {
    status = "calificado";
    const scoreStr =
      submission.score != null && submission.grade
        ? `${submission.grade}`
        : submission.score != null
          ? String(submission.score)
          : null;
    label = scoreStr ? `calificado ${scoreStr}` : "calificado";
    if (late) label += " (tarde)";
  } else if (submitted) {
    status = "entregado";
    label = late ? "entregado (tarde)" : "entregado";
  } else {
    status = "pendiente";
    label = "pendiente";
  }

  return {
    status,
    grade: submission.grade ?? null,
    score: submission.score ?? null,
    late,
    submitted,
    graded,
    label,
  };
}
