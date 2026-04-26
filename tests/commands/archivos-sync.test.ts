import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test";

const TEST_PROFILE = `test-archivos-sync-${Date.now()}`;

// Mock canvas session
mock.module("../../src/lib/auth/store.ts", () => ({
  loadCanvasSession: () => ({
    token: "test-canvas-token",
    validatedAt: new Date().toISOString(),
    userId: "test-user",
  }),
  loadIntranetSession: () => null,
}));

// Shared mock file list
function buildFiles(count: number, sizeMb: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    display_name: `file-${i + 1}.pdf`,
    filename: `file-${i + 1}.pdf`,
    content_type: "application/pdf",
    url: `https://example.com/files/${i + 1}`,
    size: sizeMb * 1024 * 1024,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    modified_at: new Date().toISOString(),
    folder_id: 1,
  }));
}

let mockFileList = buildFiles(5, 10); // 5 files × 10 MB = 50 MB by default

mock.module("../../src/lib/api/canvas/files.ts", () => ({
  listAllFiles: async () => mockFileList,
  getFile: async () => mockFileList[0],
}));

const confirmCalls: Array<{ action: string; opts: { yes: boolean; dryRun: boolean } }> = [];

class MockWienerError extends Error {
  code: string;
  hint?: string;
  constructor(code: string, message: string, hint?: string) {
    super(message);
    this.code = code;
    this.hint = hint;
  }
}

mock.module("../../src/lib/safety/confirm.ts", () => ({
  confirmT2: async (
    action: string,
    _preview: string,
    opts: { yes: boolean; dryRun: boolean; noInput?: boolean },
  ) => {
    confirmCalls.push({ action, opts });
    if (opts.dryRun) return "dry-run";
    if (opts.yes) return "proceed";
    // Throw an object that passes the duck-type check
    throw new MockWienerError(
      "validation-error",
      "T2 action requires confirmation",
      "Pass --yes to confirm",
    );
  },
}));

// Note: No node:fs mock here — it causes parallel test isolation issues.
// Tests that need actual file ops use real temp dirs.
// Tests that only check logic use dry-run or abort paths.

const capturedOutput: string[] = [];
const capturedErrors: string[] = [];

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
  auditLog: () => {},
}));

const { runArchivosSync } = await import("../../src/commands/archivos/sync.ts");

function baseOpts(overrides: Partial<Parameters<typeof runArchivosSync>[0]> = {}) {
  return {
    courseId: "course-123",
    dir: `/tmp/wiener-sync-test-${Date.now()}`,
    yes: false,
    dryRun: false,
    json: true,
    noInput: true,
    maxSizeMb: 500,
    profile: TEST_PROFILE,
    ...overrides,
  };
}

describe("archivos sync", () => {
  beforeEach(() => {
    capturedOutput.length = 0;
    capturedErrors.length = 0;
    confirmCalls.length = 0;
    mockFileList = buildFiles(5, 10); // reset
  });

  it("dry-run returns manifest with correct totalCount and totalSize", async () => {
    await runArchivosSync(baseOpts({ dryRun: true }));
    expect(capturedOutput).toHaveLength(1);
    const envelope = JSON.parse(capturedOutput[0]);
    expect(envelope.ok).toBe(true);
    expect(envelope.data.dryRun).toBe(true);
    expect(envelope.data.manifest.totalCount).toBe(5);
    expect(envelope.data.manifest.totalSize).toBe(5 * 10 * 1024 * 1024);
    expect(envelope.data.manifest.files).toHaveLength(5);
  });

  it("dry-run manifest files include id, path, and size", async () => {
    await runArchivosSync(baseOpts({ dryRun: true }));
    const envelope = JSON.parse(capturedOutput[0]);
    const firstFile = envelope.data.manifest.files[0];
    expect(firstFile).toHaveProperty("id");
    expect(firstFile).toHaveProperty("path");
    expect(firstFile).toHaveProperty("size");
    expect(typeof firstFile.id).toBe("number");
    expect(typeof firstFile.path).toBe("string");
    expect(typeof firstFile.size).toBe("number");
  });

  it("without --yes and non-interactive: validation-error with hint", async () => {
    // The confirmT2 mock throws when !yes && !dryRun.
    // runArchivosSync catches WienerError-like objects and calls process.exit(1).
    // Since process.exit(1) itself terminates, we spy on it OR catch the re-throw.
    let exitCode: number | undefined;
    const exitSpy = spyOn(process, "exit").mockImplementation((code?: number) => {
      exitCode = code;
      return undefined as never;
    });

    let caughtError: unknown;
    try {
      await runArchivosSync(baseOpts({ yes: false, noInput: true }));
    } catch (e) {
      caughtError = e;
    } finally {
      exitSpy.mockRestore();
    }

    // Either process.exit(1) was called (caught by spy) OR an error escaped
    // Either way the error should be WienerError-like with code=validation-error
    if (exitCode !== undefined) {
      expect(exitCode).toBe(1);
      expect(capturedOutput).toHaveLength(1);
      const envelope = JSON.parse(capturedOutput[0]);
      expect(envelope.ok).toBe(false);
      expect(envelope.error.code).toBe("validation-error");
    } else {
      // The error escaped — verify it has the right shape
      expect(caughtError).toBeDefined();
      expect((caughtError as { code?: string }).code).toBe("validation-error");
    }
  });

  it("exceeds max-size: errors before confirmation", async () => {
    mockFileList = buildFiles(5, 120); // 5 × 120 MB = 600 MB > 500 MB default

    let exited = false;
    const exitSpy = spyOn(process, "exit").mockImplementation((_code?: number) => {
      exited = true;
      return undefined as never;
    });

    await runArchivosSync(baseOpts({ yes: true })); // even with --yes
    exitSpy.mockRestore();

    expect(exited).toBe(true);
    const envelope = JSON.parse(capturedOutput[0]);
    expect(envelope.ok).toBe(false);
    expect(envelope.error.code).toBe("validation-error");
    expect(envelope.error.hint).toContain("--max-size");
  });

  it("with --yes: proceeds past confirmation and returns result envelope", async () => {
    // Confirm is called with yes=true → proceeds to download phase.
    // Actual downloads may fail (no mock server) — we just verify the envelope shape.
    let _exitCode: number | undefined;
    const exitSpy = spyOn(process, "exit").mockImplementation((code?: number) => {
      _exitCode = code;
      return undefined as never;
    });

    let _caughtError: unknown;
    try {
      await runArchivosSync(baseOpts({ yes: true }));
    } catch (e) {
      _caughtError = e;
    } finally {
      exitSpy.mockRestore();
    }

    // Either a result envelope or an error envelope was produced — both are acceptable.
    // What's NOT acceptable: the confirmT2 not being called.
    const dl = confirmCalls.find((c) => c.action === "archivos sync");
    expect(dl).toBeDefined();
    expect(dl?.opts.yes).toBe(true);

    // If output was produced, verify its shape
    if (capturedOutput.length > 0) {
      const envelope = JSON.parse(capturedOutput[0]);
      // Success envelope has total/downloaded/dir fields
      if (envelope.ok) {
        expect(typeof envelope.data.total).toBe("number");
        expect(typeof envelope.data.dir).toBe("string");
      }
    }
  });

  it("manifest totalSize is sum of all file sizes", async () => {
    mockFileList = buildFiles(3, 25); // 3 × 25 MB = 75 MB

    await runArchivosSync(baseOpts({ dryRun: true }));
    const envelope = JSON.parse(capturedOutput[0]);
    expect(envelope.data.manifest.totalSize).toBe(3 * 25 * 1024 * 1024);
  });
});
