import { readFileSync } from "node:fs";
import pc from "picocolors";
import { fetchActiveCourses } from "../../lib/api/canvas/courses.ts";
import { submitAssignment, uploadAssignmentFile } from "../../lib/api/canvas/submissions-upload.ts";
import { auditLog } from "../../lib/audit/log.ts";
import { loadCanvasSession } from "../../lib/auth/store.ts";
import { groupBySection } from "../../lib/courses/grouping.ts";
import { resolveCourse } from "../../lib/courses/resolver.ts";
import { CanvasServerError, WienerError, isWienerLike, toErrorEnvelope } from "../../lib/errors.ts";
import { errorEnvelope, successEnvelope } from "../../lib/output/envelope.ts";
import { printError, printLine } from "../../lib/output/human.ts";
import { printJson } from "../../lib/output/json.ts";
import { confirmT2 } from "../../lib/safety/confirm.ts";
import type { SectionType } from "../../types/course.ts";
import {
  formatDegradedDryRun,
  formatPreview,
  pickSubmissionType,
  resolveAssignment,
  validateUploads,
} from "./submit-helpers.ts";

export interface TareasSubmitOptions {
  courseRef: string;
  assignmentRef: string;
  files: string[];
  type?: string;
  text?: string;
  url?: string;
  comment?: string;
  seccion?: SectionType;
  yes: boolean;
  dryRun: boolean;
  noInput: boolean;
  json: boolean;
  exact?: boolean;
  profile: string;
}

export async function runTareasSubmit(opts: TareasSubmitOptions): Promise<void> {
  const startMs = Date.now();

  const session = await loadCanvasSession(opts.profile);
  if (!session) {
    const e = errorEnvelope(
      "canvas-not-configured",
      "No Canvas token. Run `wiener auth canvas set-token <pat>` first.",
      "wiener auth canvas set-token",
    );
    if (opts.json) {
      printJson(e);
    } else {
      printError(e.error.message);
    }
    process.exit(1);
    return;
  }

  try {
    const canvasCourses = await fetchActiveCourses(opts.profile);
    const logical = groupBySection(canvasCourses);
    const resolution = resolveCourse(opts.courseRef, logical, {
      exact: opts.exact,
      noInput: opts.noInput,
    });

    if (resolution.kind === "no-match") {
      const e = errorEnvelope(
        "course-not-found",
        `No course matching "${opts.courseRef}"`,
        "Try: wiener cursos",
      );
      if (opts.json) {
        printJson(e);
        return;
      }
      printError(`[course-not-found] No course matching "${opts.courseRef}"`);
      process.exit(1);
      return;
    }

    if (resolution.kind === "ambiguous") {
      const e = errorEnvelope(
        "course-ambiguous",
        `Multiple courses match "${opts.courseRef}"`,
        "Try: wiener cursos",
      );
      if (opts.json) {
        printJson(e);
        return;
      }
      printError(`[course-ambiguous] Multiple courses match "${opts.courseRef}"`);
      process.exit(1);
      return;
    }

    const resolvedCourse = resolution.course;
    const secciones = resolvedCourse.secciones;

    let targetCourseId: number;

    if (secciones.length > 1) {
      if (!opts.seccion) {
        if (!opts.noInput && secciones.length > 1) {
          const secList = secciones.map((s) => s.seccion).join(", ");
          throw new WienerError(
            "validation-error",
            `Course "${resolvedCourse.code}" has multiple sections: ${secList}`,
            {
              hint: `Use --seccion to pick one: ${secList}`,
              details: { secciones: secciones.map((s) => ({ id: s.id, seccion: s.seccion })) },
            },
          );
        }
      }

      const seccion = opts.seccion;
      const matched = seccion ? secciones.find((s) => s.seccion === seccion) : secciones[0];

      if (!matched) {
        throw new WienerError(
          "validation-error",
          `Section "${opts.seccion}" not found in course "${resolvedCourse.code}"`,
          {
            hint: `Available: ${secciones.map((s) => s.seccion).join(", ")}`,
          },
        );
      }

      targetCourseId = Number(matched.id);
    } else {
      targetCourseId = Number(secciones[0]?.id ?? 0);
    }

    let assignment: Awaited<ReturnType<typeof resolveAssignment>> | null = null;
    let canvasMetaDegraded = false;

    try {
      assignment = await resolveAssignment(targetCourseId, opts.assignmentRef);
    } catch (resolveErr) {
      if (resolveErr instanceof CanvasServerError && opts.dryRun) {
        canvasMetaDegraded = true;
      } else {
        throw resolveErr;
      }
    }

    if (canvasMetaDegraded) {
      const fileNames = opts.files.map((f) => {
        const parts = f.split(/[/\\]/);
        return parts[parts.length - 1] ?? f;
      });
      const degradedText = formatDegradedDryRun({
        courseCode: resolvedCourse.code,
        courseName: resolvedCourse.name,
        assignmentRef: opts.assignmentRef,
        fileNames,
        courseRef: opts.courseRef,
      });
      if (opts.json) {
        printJson(
          successEnvelope(
            {
              dryRun: true,
              degraded: true,
              courseCode: resolvedCourse.code,
              courseId: targetCourseId,
              assignmentRef: opts.assignmentRef,
              files: opts.files,
              canvasMetaAvailable: false,
            },
            { duration_ms: Date.now() - startMs, from_cache: false },
          ),
        );
      } else {
        printLine(degradedText);
      }
      return;
    }

    if (!assignment) {
      throw new WienerError("assignment-not-found", `Could not resolve assignment "${opts.assignmentRef}"`);
    }

    const now = new Date();

    if (assignment.lock_at && new Date(assignment.lock_at) < now) {
      throw new WienerError(
        "submission-locked",
        `Assignment "${assignment.name}" is locked (lock_at: ${assignment.lock_at})`,
        { hint: "The submission window has closed for this assignment." },
      );
    }

    const allowedAttempts = assignment.allowed_attempts ?? null;
    const existingSubmission = assignment.submission;
    const currentAttempt =
      existingSubmission &&
      existingSubmission.workflow_state !== "unsubmitted" &&
      existingSubmission.workflow_state !== null
        ? (existingSubmission.attempt ?? 1)
        : 0;

    if (allowedAttempts !== null && allowedAttempts > 0 && currentAttempt >= allowedAttempts) {
      throw new WienerError(
        "submission-no-attempts",
        `Ya entregaste esta tarea (intento ${currentAttempt} de ${allowedAttempts}). No se permiten más intentos.`,
        { hint: "Si necesitas re-entregar, contacta al profesor." },
      );
    }

    const alreadySubmitted =
      existingSubmission != null && existingSubmission.workflow_state !== "unsubmitted";

    if (alreadySubmitted && !opts.yes && !opts.noInput && !opts.dryRun && !opts.json) {
      const attemptStr =
        allowedAttempts !== null && allowedAttempts > 0
          ? `intento ${currentAttempt} de ${allowedAttempts}`
          : `intento ${currentAttempt}`;
      const { confirm } = await import("@clack/prompts");
      const ok = await confirm({
        message: `Ya entregaste esta tarea (${attemptStr}). ¿Quieres entregar de nuevo? (sobreescribirá el intento previo)`,
        initialValue: false,
      });
      if (!ok) {
        printLine(pc.dim("Cancelado."));
        process.exit(0);
        return;
      }
    }

    const isLate = assignment.due_at != null && new Date(assignment.due_at) < now;
    const isLastAttempt =
      allowedAttempts !== null && allowedAttempts > 0
        ? currentAttempt + 1 >= allowedAttempts
        : false;

    const submissionType = pickSubmissionType(assignment, opts.type);

    let filesValidation: ReturnType<typeof validateUploads> | undefined;
    let textBody: string | undefined;
    let urlValue: string | undefined;

    if (submissionType === "online_upload") {
      let filePaths = opts.files;

      if (filePaths.length === 0 && !process.stdin.isTTY) {
        const stdin = readFileSync("/dev/stdin", "utf-8").trim();
        if (stdin) {
          filePaths = stdin
            .split(/\s+/)
            .map((s) => s.trim())
            .filter(Boolean);
        }
      }

      filesValidation = validateUploads(assignment, filePaths);
    } else if (submissionType === "online_text_entry") {
      if (opts.text) {
        textBody = opts.text;
      } else if (!process.stdin.isTTY) {
        textBody = readFileSync("/dev/stdin", "utf-8");
      }

      if (!textBody) {
        throw new WienerError(
          "validation-error",
          "Text body required for online_text_entry submission",
          { hint: 'Use --text "..." or pipe text via stdin' },
        );
      }
    } else if (submissionType === "online_url") {
      if (!opts.url) {
        throw new WienerError("validation-error", "URL required for online_url submission", {
          hint: "Use --url https://...",
        });
      }

      try {
        new URL(opts.url);
      } catch {
        throw new WienerError("validation-error", `Invalid URL: "${opts.url}"`, {
          hint: "URL must include scheme, e.g. https://example.com",
        });
      }

      urlValue = opts.url;
    }

    const previewData = {
      courseCode: resolvedCourse.code,
      courseName: resolvedCourse.name,
      assignment,
      submissionType,
      files: filesValidation?.files,
      textBody,
      url: urlValue,
      comment: opts.comment,
      isLate,
      isLastAttempt,
      alreadySubmitted,
      currentAttempt,
      allowedAttempts,
    };
    const previewText = formatPreview(previewData);

    const decision = await confirmT2("tareas submit", previewText, {
      yes: opts.yes,
      dryRun: opts.dryRun,
      noInput: opts.noInput,
    });

    if (decision === "dry-run") {
      const data = {
        dryRun: true,
        courseCode: resolvedCourse.code,
        courseName: resolvedCourse.name,
        courseId: targetCourseId,
        assignmentId: assignment.id,
        assignmentName: assignment.name,
        submissionType,
        files: filesValidation?.files ?? null,
        textBody: textBody ?? null,
        url: urlValue ?? null,
        comment: opts.comment ?? null,
        isLate,
        isLastAttempt,
        alreadySubmitted,
        currentAttempt,
        allowedAttempts,
      };

      if (opts.json) {
        printJson(successEnvelope(data, { duration_ms: Date.now() - startMs, from_cache: false }));
      } else {
        printLine(previewText);
        printLine(pc.dim("\n[dry-run] No action taken."));
      }
      return;
    }

    if (decision === "aborted") {
      if (opts.json) {
        printJson(errorEnvelope("validation-error", "Cancelled by user."));
      } else {
        printLine(pc.dim("Cancelled."));
      }
      process.exit(0);
      return;
    }

    auditLog({
      ts: new Date().toISOString(),
      command: "tareas submit",
      trust: "T2",
      profile: opts.profile,
      args: {
        courseRef: opts.courseRef,
        assignmentRef: opts.assignmentRef,
        submissionType,
        fileCount: filesValidation?.files?.length ?? 0,
      },
      result: "ok",
    });

    let submissionPayload: Parameters<typeof submitAssignment>[2];

    if (submissionType === "online_upload") {
      const files = filesValidation?.files ?? [];
      const uploadedIds: number[] = [];

      if (!opts.json) {
        printLine(pc.cyan("Subiendo archivos..."));
      }

      for (const file of files) {
        const uploaded = await uploadAssignmentFile(
          targetCourseId,
          assignment.id,
          file.path,
          session.token,
        );
        uploadedIds.push(uploaded.id);

        if (!opts.json) {
          printLine(pc.green(`  ✓ ${file.name} → id:${uploaded.id}`));
        }
      }

      submissionPayload = { type: "online_upload", file_ids: uploadedIds };
    } else if (submissionType === "online_text_entry") {
      submissionPayload = { type: "online_text_entry", body: textBody ?? "" };
    } else {
      submissionPayload = { type: "online_url", url: urlValue ?? "" };
    }

    const submissionResponse = await submitAssignment(
      targetCourseId,
      assignment.id,
      submissionPayload,
      session.token,
      opts.comment,
    );

    const durationMs = Date.now() - startMs;

    auditLog({
      ts: new Date().toISOString(),
      command: "tareas submit",
      trust: "T2",
      profile: opts.profile,
      args: {
        submissionId: submissionResponse.id,
        courseId: targetCourseId,
        assignmentId: assignment.id,
      },
      result: "ok",
      duration_ms: durationMs,
    });

    const resultData = {
      ok: true,
      submission_id: submissionResponse.id,
      submitted_at: submissionResponse.submitted_at,
      attempt_number: submissionResponse.attempt,
      late: submissionResponse.late ?? isLate,
      workflow_state: submissionResponse.workflow_state,
      files:
        submissionType === "online_upload"
          ? (submissionResponse.attachments?.map((a) => ({ id: a.id, name: a.display_name })) ??
            filesValidation?.files?.map((f) => ({ name: f.name })) ??
            [])
          : [],
    };

    if (opts.json) {
      printJson(successEnvelope(resultData, { duration_ms: durationMs, from_cache: false }));
    } else {
      printLine(pc.green(`\n✓ Tarea entregada: ${assignment.name}`));
      printLine(
        pc.dim(
          `  Submission ID: ${submissionResponse.id} · ` +
            `Entregado: ${submissionResponse.submitted_at ? new Date(submissionResponse.submitted_at).toLocaleString("es-PE") : "—"} · ` +
            `${durationMs}ms`,
        ),
      );
      if (isLate) {
        printLine(pc.yellow("  Advertencia: entrega tardía."));
      }
    }
  } catch (e) {
    auditLog({
      ts: new Date().toISOString(),
      command: "tareas submit",
      trust: "T2",
      profile: opts.profile,
      args: { courseRef: opts.courseRef, assignmentRef: opts.assignmentRef },
      result: "error",
      error_code: isWienerLike(e) ? e.code : "unknown-error",
    });

    if (opts.json) {
      printJson(
        toErrorEnvelope(e, {
          courseRef: opts.courseRef,
          assignmentRef: opts.assignmentRef,
          step: "fetch-assignment-detail",
        }),
      );
      return;
    }

    if (isWienerLike(e)) {
      printError(`[${e.code}] ${e.message}`);
      if (e.hint) printLine(pc.dim(`Hint: ${e.hint}`));
    } else {
      printError(e instanceof Error ? e.message : String(e));
    }
    process.exit(1);
  }
}
