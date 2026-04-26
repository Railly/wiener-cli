import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const TEST_PROFILE = `test-tareas-submit-${Date.now()}`;

// ─── Shared mock state ────────────────────────────────────────────────────────

const capturedOutput: string[] = [];
const capturedErrors: string[] = [];
const auditCalls: unknown[] = [];
const uploadedFiles: Array<{ courseId: number; assignmentId: number; path: string }> = [];
const submitCalls: Array<{
  courseId: number;
  assignmentId: number;
  payload: unknown;
  comment: unknown;
}> = [];

// ─── Mock modules ────────────────────────────────────────────────────────────

mock.module("../../src/lib/auth/store.ts", () => ({
  loadCanvasSession: (_profile: string) => ({
    token: "test-canvas-token",
    validatedAt: new Date().toISOString(),
    userId: "test-user",
  }),
  loadIntranetSession: () => null,
}));

const COURSES = [
  {
    id: 100,
    course_code: "AC6M28",
    name: "CIENCIA Y DESCUBRIMIENTO",
    enrollments: [{ role: "StudentEnrollment", enrollment_state: "active" }],
  },
  {
    id: 200,
    course_code: "FB6N1",
    name: "FARMACIA CLINICA I",
    enrollments: [{ role: "StudentEnrollment", enrollment_state: "active" }],
  },
];

mock.module("../../src/lib/api/canvas/courses.ts", () => ({
  fetchActiveCourses: async () => COURSES,
}));

const makeAssignment = (
  overrides: Partial<{
    id: number;
    name: string;
    due_at: string | null;
    lock_at: string | null;
    points_possible: number;
    submission_types: string[];
    allowed_attempts: number;
    allowed_extensions: string[];
    submission: unknown;
  }> = {},
) => ({
  id: 42,
  course_id: 100,
  name: "Informe semanal UD2",
  due_at: new Date(Date.now() + 4 * 3_600_000).toISOString(),
  lock_at: null,
  points_possible: 20,
  submission_types: ["online_upload"],
  allowed_attempts: 3,
  allowed_extensions: [],
  html_url: "https://canvas.uwiener.edu.pe/courses/100/assignments/42",
  submission: null,
  ...overrides,
});

let assignmentFactory = () => makeAssignment();

mock.module("../../src/lib/api/canvas/assignments.ts", () => ({
  fetchAssignment: async (_courseId: number, _id: number) => assignmentFactory(),
  fetchAssignments: async (_courseId: number) => [
    assignmentFactory(),
    makeAssignment({ id: 43, name: "Foro: ética científica" }),
  ],
}));

mock.module("../../src/lib/api/canvas/submissions-upload.ts", () => ({
  uploadAssignmentFile: async (courseId: number, assignmentId: number, filePath: string) => {
    uploadedFiles.push({ courseId, assignmentId, path: filePath });
    return { id: 999, name: "informe-semanal-ud2.pdf" };
  },
  submitAssignment: async (
    courseId: number,
    assignmentId: number,
    payload: unknown,
    _token: string,
    comment: unknown,
  ) => {
    submitCalls.push({ courseId, assignmentId, payload, comment });
    return {
      id: 77,
      assignment_id: assignmentId,
      user_id: "test-user",
      submitted_at: new Date().toISOString(),
      workflow_state: "submitted",
      attempt: 1,
      late: false,
      missing: false,
      score: null,
      grade: null,
      attachments: [{ id: 999, display_name: "informe-semanal-ud2.pdf" }],
    };
  },
}));

mock.module("../../src/lib/safety/confirm.ts", () => ({
  confirmT2: async (
    _action: string,
    _preview: string,
    opts: { yes: boolean; dryRun: boolean; noInput?: boolean },
  ) => {
    if (opts.dryRun) return "dry-run";
    if (opts.yes) return "proceed";
    return "aborted";
  },
}));

mock.module("../../src/lib/output/json.ts", () => ({
  printJson: (v: unknown) => {
    capturedOutput.push(JSON.stringify(v));
  },
  printJsonCompact: (v: unknown) => {
    capturedOutput.push(JSON.stringify(v));
  },
}));

mock.module("../../src/lib/output/human.ts", () => ({
  printLine: (_msg: string) => {},
  printHr: () => {},
  printHeader: () => {},
  printSuccess: () => {},
  printWarn: () => {},
  printError: (msg: string) => {
    capturedErrors.push(msg);
  },
}));

mock.module("../../src/lib/audit/log.ts", () => ({
  auditLog: (entry: unknown) => {
    auditCalls.push(entry);
  },
  shouldAudit: () => true,
}));

// ─── Import command under test (AFTER all mock.module calls) ─────────────────

const { runTareasSubmit } = await import("../../src/commands/tareas/submit.ts");
const { resolveAssignment, validateUploads, pickSubmissionType, formatPreview } = await import(
  "../../src/commands/tareas/submit-helpers.ts"
);

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TMP_DIR = tmpdir();

function makeTmpFile(name = "test.pdf", content = "fake pdf content"): string {
  const path = join(TMP_DIR, `wiener-test-${Date.now()}-${name}`);
  writeFileSync(path, content);
  return path;
}

function baseOpts(
  overrides: Partial<Parameters<typeof runTareasSubmit>[0]> = {},
): Parameters<typeof runTareasSubmit>[0] {
  return {
    courseRef: "ciencia",
    assignmentRef: "42",
    files: [],
    type: "auto",
    text: undefined,
    url: undefined,
    comment: undefined,
    yes: true,
    dryRun: false,
    noInput: true,
    json: true,
    profile: TEST_PROFILE,
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("tareas submit", () => {
  beforeEach(() => {
    capturedOutput.length = 0;
    capturedErrors.length = 0;
    auditCalls.length = 0;
    uploadedFiles.length = 0;
    submitCalls.length = 0;
    assignmentFactory = () => makeAssignment();
  });

  // ── 1. Resolve assignment by exact numeric id ─────────────────────────────

  it("resolves assignment by exact numeric id", async () => {
    const a = await resolveAssignment(100, "42");
    expect(a.id).toBe(42);
  });

  // ── 2. Resolve assignment by fuzzy name ──────────────────────────────────

  it("resolves assignment by fuzzy name substring", async () => {
    const a = await resolveAssignment(100, "informe");
    expect(a.name).toBe("Informe semanal UD2");
  });

  // ── 3. Multiple match → ambiguous error ──────────────────────────────────

  it("throws assignment-ambiguous when multiple assignments match", async () => {
    mock.module("../../src/lib/api/canvas/assignments.ts", () => ({
      fetchAssignment: async () => makeAssignment(),
      fetchAssignments: async () => [
        makeAssignment({ id: 10, name: "Informe A" }),
        makeAssignment({ id: 11, name: "Informe B" }),
      ],
    }));

    const { resolveAssignment: ra } = await import("../../src/commands/tareas/submit-helpers.ts");

    let threw = false;
    try {
      await ra(100, "Informe");
    } catch (e) {
      threw = true;
      expect((e as { code: string }).code).toBe("assignment-ambiguous");
    }
    expect(threw).toBe(true);

    mock.module("../../src/lib/api/canvas/assignments.ts", () => ({
      fetchAssignment: async () => assignmentFactory(),
      fetchAssignments: async () => [
        assignmentFactory(),
        makeAssignment({ id: 43, name: "Foro: ética científica" }),
      ],
    }));
  });

  // ── 4. past lock_at → submission-locked ──────────────────────────────────

  it("exits with submission-locked when lock_at is in the past", async () => {
    assignmentFactory = () =>
      makeAssignment({ lock_at: new Date(Date.now() - 1_000).toISOString() });

    const exitSpy = spyOn(process, "exit").mockImplementation(() => undefined as never);
    await runTareasSubmit(baseOpts({ files: [] }));
    exitSpy.mockRestore();

    expect(capturedOutput.length).toBeGreaterThan(0);
    const envelope = JSON.parse(capturedOutput[0]);
    expect(envelope.ok).toBe(false);
    expect(envelope.error.code).toBe("submission-locked");
  });

  // ── 5. No attempts left → submission-no-attempts ─────────────────────────

  it("exits with submission-no-attempts when all attempts exhausted", async () => {
    assignmentFactory = () =>
      makeAssignment({
        allowed_attempts: 2,
        submission: {
          workflow_state: "submitted",
          attempt: 2,
        },
      });

    const exitSpy = spyOn(process, "exit").mockImplementation(() => undefined as never);
    await runTareasSubmit(baseOpts());
    exitSpy.mockRestore();

    expect(capturedOutput.length).toBeGreaterThan(0);
    const envelope = JSON.parse(capturedOutput[0]);
    expect(envelope.ok).toBe(false);
    expect(envelope.error.code).toBe("submission-no-attempts");
  });

  // ── 6. File doesn't exist → file-not-found ───────────────────────────────

  it("throws file-not-found if a file path does not exist", () => {
    const assignment = makeAssignment();
    let threw = false;
    try {
      validateUploads(assignment, ["/tmp/does-not-exist-wiener-test-12345.pdf"]);
    } catch (e) {
      threw = true;
      expect((e as { code: string }).code).toBe("file-not-found");
    }
    expect(threw).toBe(true);
  });

  // ── 7. Disallowed extension → submission-invalid-extension ───────────────

  it("throws submission-invalid-extension for disallowed file extension", () => {
    const assignment = makeAssignment({ allowed_extensions: ["pdf", "docx"] });
    const tmpFile = makeTmpFile("report.exe");
    let threw = false;
    try {
      validateUploads(assignment, [tmpFile]);
    } catch (e) {
      threw = true;
      expect((e as { code: string }).code).toBe("submission-invalid-extension");
    }
    expect(threw).toBe(true);
    if (existsSync(tmpFile)) rmSync(tmpFile);
  });

  // ── 8. dry-run returns preview without submitting ─────────────────────────

  it("dry-run returns preview envelope without uploading or submitting", async () => {
    const tmpFile = makeTmpFile("informe.pdf");

    await runTareasSubmit(baseOpts({ files: [tmpFile], dryRun: true, yes: false }));

    expect(capturedOutput).toHaveLength(1);
    const envelope = JSON.parse(capturedOutput[0]);
    expect(envelope.ok).toBe(true);
    expect(envelope.data.dryRun).toBe(true);
    expect(envelope.data.assignmentId).toBe(42);
    expect(envelope.data.submissionType).toBe("online_upload");

    expect(uploadedFiles).toHaveLength(0);
    expect(submitCalls).toHaveLength(0);

    rmSync(tmpFile);
  });

  // ── 9. Auto-detect submission type — single type ──────────────────────────

  it("auto-detects online_upload when assignment has single type", () => {
    const assignment = makeAssignment({ submission_types: ["online_upload"] });
    const type = pickSubmissionType(assignment, "auto");
    expect(type).toBe("online_upload");
  });

  it("auto-detects online_text_entry when assignment has single type", () => {
    const assignment = makeAssignment({ submission_types: ["online_text_entry"] });
    const type = pickSubmissionType(assignment, "auto");
    expect(type).toBe("online_text_entry");
  });

  // ── 10. Multiple submission types + no --type → error ────────────────────

  it("throws validation-error when assignment has multiple types and no --type given", () => {
    const assignment = makeAssignment({
      submission_types: ["online_upload", "online_text_entry"],
    });
    let threw = false;
    try {
      pickSubmissionType(assignment, "auto");
    } catch (e) {
      threw = true;
      expect((e as { code: string }).code).toBe("validation-error");
    }
    expect(threw).toBe(true);
  });

  // ── 11. Successful upload + submit ───────────────────────────────────────

  it("uploads files and submits with correct file_ids on success", async () => {
    const tmpFile = makeTmpFile("informe-ud2.pdf");

    await runTareasSubmit(baseOpts({ files: [tmpFile] }));

    expect(capturedOutput).toHaveLength(1);
    const envelope = JSON.parse(capturedOutput[0]);
    expect(envelope.ok).toBe(true);
    expect(envelope.data.submission_id).toBe(77);
    expect(envelope.data.workflow_state).toBe("submitted");

    expect(uploadedFiles).toHaveLength(1);
    expect(uploadedFiles[0].path).toBe(tmpFile);

    expect(submitCalls).toHaveLength(1);
    expect((submitCalls[0].payload as { type: string }).type).toBe("online_upload");
    expect((submitCalls[0].payload as { file_ids: number[] }).file_ids).toEqual([999]);

    rmSync(tmpFile);
  });

  // ── 12. Audit log entry written ───────────────────────────────────────────

  it("writes audit log entries on successful submission", async () => {
    const tmpFile = makeTmpFile("audit-test.pdf");

    await runTareasSubmit(baseOpts({ files: [tmpFile] }));

    expect(auditCalls.length).toBeGreaterThanOrEqual(1);
    const anyAudit = auditCalls.some((a) => (a as { command: string }).command === "tareas submit");
    expect(anyAudit).toBe(true);

    rmSync(tmpFile);
  });

  // ── 13. online_text_entry with --text ─────────────────────────────────────

  it("submits online_text_entry with --text body", async () => {
    assignmentFactory = () => makeAssignment({ submission_types: ["online_text_entry"] });

    await runTareasSubmit(baseOpts({ text: "<p>Mi reflexión</p>", type: "online_text_entry" }));

    expect(capturedOutput).toHaveLength(1);
    const envelope = JSON.parse(capturedOutput[0]);
    expect(envelope.ok).toBe(true);
    expect(submitCalls).toHaveLength(1);
    expect((submitCalls[0].payload as { type: string }).type).toBe("online_text_entry");
    expect((submitCalls[0].payload as { body: string }).body).toBe("<p>Mi reflexión</p>");
  });

  // ── 14. online_url with --url ─────────────────────────────────────────────

  it("submits online_url with --url value", async () => {
    assignmentFactory = () => makeAssignment({ submission_types: ["online_url"] });

    await runTareasSubmit(baseOpts({ url: "https://docs.google.com/my-doc", type: "online_url" }));

    expect(capturedOutput).toHaveLength(1);
    const envelope = JSON.parse(capturedOutput[0]);
    expect(envelope.ok).toBe(true);
    expect(submitCalls).toHaveLength(1);
    expect((submitCalls[0].payload as { type: string }).type).toBe("online_url");
    expect((submitCalls[0].payload as { url: string }).url).toBe("https://docs.google.com/my-doc");
  });

  // ── 15. Invalid URL → validation-error ───────────────────────────────────

  it("exits with validation-error for invalid URL", async () => {
    assignmentFactory = () => makeAssignment({ submission_types: ["online_url"] });

    const exitSpy = spyOn(process, "exit").mockImplementation(() => undefined as never);
    await runTareasSubmit(baseOpts({ url: "not-a-url", type: "online_url" }));
    exitSpy.mockRestore();

    expect(capturedOutput.length).toBeGreaterThan(0);
    const envelope = JSON.parse(capturedOutput[0]);
    expect(envelope.ok).toBe(false);
    expect(envelope.error.code).toBe("validation-error");
  });

  // ── 16. formatPreview contains expected sections ──────────────────────────

  it("formatPreview includes course code, assignment name, and type", () => {
    const assignment = makeAssignment();
    const preview = formatPreview({
      courseCode: "AC6M28",
      courseName: "CIENCIA Y DESCUBRIMIENTO",
      assignment,
      submissionType: "online_upload",
      files: [{ path: "/tmp/x.pdf", name: "x.pdf", size: 1024 * 100, sizeHuman: "100 KB" }],
      comment: undefined,
      isLate: false,
      isLastAttempt: false,
      alreadySubmitted: false,
      currentAttempt: 0,
      allowedAttempts: 3,
    });

    expect(preview).toContain("AC6M28");
    expect(preview).toContain("CIENCIA Y DESCUBRIMIENTO");
    expect(preview).toContain("Informe semanal UD2");
    expect(preview).toContain("online_upload");
    expect(preview).toContain("x.pdf");
  });

  // ── 17. Warning in preview when already submitted ─────────────────────────

  it("formatPreview includes re-submit warning when alreadySubmitted=true", () => {
    const assignment = makeAssignment();
    const preview = formatPreview({
      courseCode: "AC6M28",
      courseName: "TEST",
      assignment,
      submissionType: "online_upload",
      isLate: false,
      isLastAttempt: false,
      alreadySubmitted: true,
      currentAttempt: 1,
      allowedAttempts: 3,
    });
    expect(preview).toContain("reemplazada");
  });

  // ── 18. Warning in preview when last attempt ─────────────────────────────

  it("formatPreview includes ÚLTIMO INTENTO warning", () => {
    const assignment = makeAssignment();
    const preview = formatPreview({
      courseCode: "AC6M28",
      courseName: "TEST",
      assignment,
      submissionType: "online_upload",
      isLate: false,
      isLastAttempt: true,
      alreadySubmitted: false,
      currentAttempt: 2,
      allowedAttempts: 3,
    });
    expect(preview).toContain("ÚLTIMO INTENTO");
  });

  // ── 19. Canvas-not-configured exits cleanly ───────────────────────────────

  it("exits with canvas-not-configured when no token", async () => {
    mock.module("../../src/lib/auth/store.ts", () => ({
      loadCanvasSession: () => null,
      loadIntranetSession: () => null,
    }));

    const { runTareasSubmit: runSubmit } = await import("../../src/commands/tareas/submit.ts");

    const exitSpy = spyOn(process, "exit").mockImplementation(() => undefined as never);
    await runSubmit(baseOpts());
    exitSpy.mockRestore();

    const found = capturedOutput.some((out) => {
      const p = JSON.parse(out);
      return p.ok === false && p.error.code === "canvas-not-configured";
    });
    expect(found).toBe(true);

    mock.module("../../src/lib/auth/store.ts", () => ({
      loadCanvasSession: () => ({
        token: "test-canvas-token",
        validatedAt: new Date().toISOString(),
        userId: "test-user",
      }),
      loadIntranetSession: () => null,
    }));
  });
});
