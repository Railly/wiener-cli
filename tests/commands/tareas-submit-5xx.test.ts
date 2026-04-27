import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import { rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const TEST_PROFILE = `test-5xx-submit-${Date.now()}`;

const capturedOutput: string[] = [];
const capturedErrors: string[] = [];
const fetchAssignmentCalls: Array<{ courseId: number; assignmentId: number }> = [];
const fetchAssignmentsCalls: number[] = [];

mock.module("../../src/lib/auth/store.ts", () => ({
  loadCanvasSession: () => ({
    token: "test-canvas-token",
    validatedAt: new Date().toISOString(),
    userId: "test-user",
  }),
  loadIntranetSession: () => null,
}));

const COURSES = [
  {
    id: 125762,
    course_code: "FB6N1",
    name: "TERAPÉUTICA FARMACOLÓGICA III",
    enrollments: [{ role: "StudentEnrollment", enrollment_state: "active" }],
  },
];

mock.module("../../src/lib/api/canvas/courses.ts", () => ({
  fetchActiveCourses: async () => COURSES,
}));

const makeAssignment = (overrides: Record<string, unknown> = {}) => ({
  id: 964256,
  course_id: 125762,
  name: "KWL Farmacoterapia oncologica",
  due_at: new Date(Date.now() + 4 * 3_600_000).toISOString(),
  lock_at: null,
  points_possible: 20,
  submission_types: ["online_upload"],
  allowed_attempts: 3,
  allowed_extensions: ["pdf"],
  html_url: "https://canvas.uwiener.edu.pe/courses/125762/assignments/964256",
  submission: null,
  ...overrides,
});

let assignmentFactory: (() => ReturnType<typeof makeAssignment>) | (() => never) = () =>
  makeAssignment();
let fetchAssignmentCallCount = 0;

mock.module("../../src/lib/api/canvas/assignments.ts", () => ({
  fetchAssignment: async (courseId: number, assignmentId: number) => {
    fetchAssignmentCalls.push({ courseId, assignmentId });
    fetchAssignmentCallCount++;
    return assignmentFactory();
  },
  fetchAssignments: async (courseId: number) => {
    fetchAssignmentsCalls.push(courseId);
    return [assignmentFactory()];
  },
}));

mock.module("../../src/lib/api/canvas/submissions-upload.ts", () => ({
  uploadAssignmentFile: async () => ({ id: 999, name: "test.pdf" }),
  submitAssignment: async () => ({
    id: 77,
    assignment_id: 964256,
    user_id: "test-user",
    submitted_at: new Date().toISOString(),
    workflow_state: "submitted",
    attempt: 2,
    late: false,
    missing: false,
    score: null,
    grade: null,
    attachments: [{ id: 999, display_name: "test.pdf" }],
  }),
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
  printLine: (msg: string) => {
    capturedOutput.push(msg);
  },
  printHr: () => {},
  printHeader: () => {},
  printSuccess: () => {},
  printWarn: () => {},
  printError: (msg: string) => {
    capturedErrors.push(msg);
  },
}));

mock.module("../../src/lib/audit/log.ts", () => ({
  auditLog: () => {},
  shouldAudit: () => true,
}));

const { runTareasSubmit } = await import("../../src/commands/tareas/submit.ts");
const { CanvasServerError, is5xxError, toErrorEnvelope } = await import(
  "../../src/lib/errors.ts"
);
const { getAssignment } = await import("../../src/lib/api/canvas/assignments.ts");

const TMP_DIR = tmpdir();

function makeTmpFile(name = "test.pdf"): string {
  const path = join(TMP_DIR, `wiener-5xx-test-${Date.now()}-${name}`);
  writeFileSync(path, "fake pdf content");
  return path;
}

function baseOpts(overrides: Record<string, unknown> = {}) {
  return {
    courseRef: "terapeutica",
    assignmentRef: "964256",
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
  } as Parameters<typeof runTareasSubmit>[0];
}

describe("tareas submit — 5xx handling", () => {
  beforeEach(() => {
    capturedOutput.length = 0;
    capturedErrors.length = 0;
    fetchAssignmentCalls.length = 0;
    fetchAssignmentsCalls.length = 0;
    fetchAssignmentCallCount = 0;
    assignmentFactory = () => makeAssignment();
  });

  it("CanvasServerError is a 5xx error", () => {
    const e = new CanvasServerError(500, "/api/v1/courses/1/assignments/2");
    expect(is5xxError(e)).toBe(true);
  });

  it("is5xxError detects Error with status 500 in message", () => {
    const e = new Error("Canvas returned status 500 from server");
    expect(is5xxError(e)).toBe(true);
  });

  it("is5xxError returns false for 4xx errors", () => {
    const e = new Error("Canvas returned status 404");
    expect(is5xxError(e)).toBe(false);
  });

  it("toErrorEnvelope for CanvasServerError includes next_steps", () => {
    const e = new CanvasServerError(500, "/api/v1/courses/125762/assignments/964256");
    const envelope = toErrorEnvelope(e, {
      courseRef: "terapeutica",
      assignmentRef: "964256",
      step: "fetch-assignment-detail",
    });
    expect(envelope.ok).toBe(false);
    expect(envelope.error.code).toBe("canvas-server-error");
    expect(envelope.error.next_steps).toBeArray();
    expect(envelope.error.next_steps?.length).toBeGreaterThan(0);
    expect(envelope.error.details).toBeDefined();
    const details = envelope.error.details as Record<string, unknown>;
    expect(details.step).toBe("fetch-assignment-detail");
    expect(details.assignment_id).toBe("964256");
    expect(details.retries_attempted).toBe(2);
  });

  it("toErrorEnvelope for CanvasServerError includes wiener cursos abrir command", () => {
    const e = new CanvasServerError(503, "/api/v1/courses/125762/assignments/964256");
    const envelope = toErrorEnvelope(e, { courseRef: "terapeutica", assignmentRef: "964256" });
    const commands = envelope.error.next_steps?.map((s) => s.command) ?? [];
    expect(commands.some((c) => c.includes("wiener cursos abrir terapeutica"))).toBe(true);
  });

  it("numeric assignmentRef resolves via fetchAssignment, NOT fetchAssignments", async () => {
    const tmpFile = makeTmpFile("oncologia.pdf");
    await runTareasSubmit(baseOpts({ files: [tmpFile], assignmentRef: "964256" }));
    rmSync(tmpFile);

    expect(fetchAssignmentCalls.length).toBeGreaterThan(0);
    expect(fetchAssignmentCalls[0].assignmentId).toBe(964256);
    expect(fetchAssignmentsCalls.length).toBe(0);
  });

  it("dry-run with persistent 5xx returns degraded preview, exit 0 (human output)", async () => {
    assignmentFactory = () => {
      throw new CanvasServerError(500, "/api/v1/courses/125762/assignments/964256");
    };

    const exitSpy = spyOn(process, "exit").mockImplementation(() => undefined as never);
    const tmpFile = makeTmpFile("farmacoterapia.pdf");
    await runTareasSubmit(
      baseOpts({ files: [tmpFile], dryRun: true, yes: false, json: false }),
    );
    exitSpy.mockRestore();
    rmSync(tmpFile);

    expect(capturedOutput.some((line) => line.includes("Metadata Canvas no disponible"))).toBe(
      true,
    );
    expect(capturedOutput.some((line) => line.includes("PREVIEW"))).toBe(true);
    expect(exitSpy).not.toHaveBeenCalledWith(1);
  });

  it("dry-run with persistent 5xx returns degraded JSON envelope with ok:true", async () => {
    assignmentFactory = () => {
      throw new CanvasServerError(500, "/api/v1/courses/125762/assignments/964256");
    };

    const exitSpy = spyOn(process, "exit").mockImplementation(() => undefined as never);
    const tmpFile = makeTmpFile("farmacoterapia.pdf");
    await runTareasSubmit(
      baseOpts({ files: [tmpFile], dryRun: true, yes: false, json: true }),
    );
    exitSpy.mockRestore();
    rmSync(tmpFile);

    expect(capturedOutput.length).toBeGreaterThan(0);
    const envelope = JSON.parse(capturedOutput[0]);
    expect(envelope.ok).toBe(true);
    expect(envelope.data.dryRun).toBe(true);
    expect(envelope.data.degraded).toBe(true);
    expect(envelope.data.canvasMetaAvailable).toBe(false);
  });

  it("non-dry-run with persistent 5xx emits canvas-server-error JSON envelope", async () => {
    assignmentFactory = () => {
      throw new CanvasServerError(500, "/api/v1/courses/125762/assignments/964256");
    };

    const exitSpy = spyOn(process, "exit").mockImplementation(() => undefined as never);
    const tmpFile = makeTmpFile("farmacoterapia.pdf");
    await runTareasSubmit(baseOpts({ files: [tmpFile], json: true }));
    exitSpy.mockRestore();
    rmSync(tmpFile);

    expect(capturedOutput.length).toBeGreaterThan(0);
    const envelope = JSON.parse(capturedOutput[0]);
    expect(envelope.ok).toBe(false);
    expect(envelope.error.code).toBe("canvas-server-error");
    expect(envelope.error.next_steps).toBeArray();
  });

  it("already submitted with attempts remaining does not throw (proceeds with --yes)", async () => {
    assignmentFactory = () =>
      makeAssignment({
        allowed_attempts: 3,
        submission: { workflow_state: "submitted", attempt: 1 },
      });

    const tmpFile = makeTmpFile("reentrega.pdf");
    await runTareasSubmit(baseOpts({ files: [tmpFile], yes: true }));
    rmSync(tmpFile);

    expect(capturedOutput.length).toBeGreaterThan(0);
    const envelope = JSON.parse(capturedOutput[0]);
    expect(envelope.ok).toBe(true);
    expect(envelope.data.submission_id).toBe(77);
  });

  it("already submitted with no attempts left → submission-no-attempts", async () => {
    assignmentFactory = () =>
      makeAssignment({
        allowed_attempts: 1,
        submission: { workflow_state: "submitted", attempt: 1 },
      });

    const exitSpy = spyOn(process, "exit").mockImplementation(() => undefined as never);
    await runTareasSubmit(baseOpts());
    exitSpy.mockRestore();

    expect(capturedOutput.length).toBeGreaterThan(0);
    const envelope = JSON.parse(capturedOutput[0]);
    expect(envelope.ok).toBe(false);
    expect(envelope.error.code).toBe("submission-no-attempts");
    expect(envelope.error.hint).toContain("profesor");
  });

  it("degraded dry-run includes assignment ref and course in output", async () => {
    assignmentFactory = () => {
      throw new CanvasServerError(502, "/api/v1/courses/125762/assignments/964256");
    };

    const exitSpy = spyOn(process, "exit").mockImplementation(() => undefined as never);
    const tmpFile = makeTmpFile("tarea.pdf");
    await runTareasSubmit(
      baseOpts({ files: [tmpFile], dryRun: true, yes: false, json: false }),
    );
    exitSpy.mockRestore();
    rmSync(tmpFile);

    const combined = capturedOutput.join("\n");
    expect(combined).toContain("964256");
    expect(combined).toContain("FB6N1");
  });
});
