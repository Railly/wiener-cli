import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test";

const SMALL_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const LARGE_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

const TEST_PROFILE = `test-archivos-dl-${Date.now()}`;

// Mock canvas session
mock.module("../../src/lib/auth/store.ts", () => ({
  loadCanvasSession: () => ({
    token: "test-canvas-token",
    validatedAt: new Date().toISOString(),
    userId: "test-user",
  }),
  loadIntranetSession: () => null,
}));

// Mock confirmT2 — records the call and respects opts
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
    throw new MockWienerError(
      "validation-error",
      "T2 action requires confirmation",
      "Pass --yes to confirm",
    );
  },
}));

// Mock getFile
mock.module("../../src/lib/api/canvas/files.ts", () => ({
  getFile: async (fileId: string, _token: string) => {
    const size = fileId === "large-file" ? LARGE_FILE_SIZE : SMALL_FILE_SIZE;
    return {
      id: Number.parseInt(fileId) || 1,
      display_name: fileId === "large-file" ? "big-lecture.mp4" : "notes.pdf",
      filename: "file.pdf",
      content_type: "application/pdf",
      url: `https://example.com/files/${fileId}`,
      size,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      modified_at: new Date().toISOString(),
      folder_id: 1,
    };
  },
  listAllFiles: async () => [],
}));

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

const { runArchivosDownload } = await import("../../src/commands/archivos/download.ts");

function baseOpts(
  fileId: string,
  overrides: Partial<Parameters<typeof runArchivosDownload>[0]> = {},
) {
  return {
    fileId,
    out: `/tmp/wiener-test-dl-${Date.now()}`,
    yes: false,
    dryRun: false,
    force: false,
    json: true,
    noInput: true,
    profile: TEST_PROFILE,
    ...overrides,
  };
}

describe("archivos download", () => {
  beforeEach(() => {
    capturedOutput.length = 0;
    capturedErrors.length = 0;
    confirmCalls.length = 0;
  });

  it("small file (≤50MB): does NOT trigger T2 confirm call", async () => {
    // For small files, confirmT2 should not be called.
    // The download itself may or may not succeed depending on the env,
    // but no T2 confirm should fire.
    let _exitCode: number | undefined;
    const exitSpy = spyOn(process, "exit").mockImplementation((code?: number) => {
      _exitCode = code;
      return undefined as never;
    });

    try {
      await runArchivosDownload(baseOpts("small-file"));
    } catch {
      // ignore errors from actual file write
    } finally {
      exitSpy.mockRestore();
    }

    // Key assertion: no T2 confirm was called for a small file
    expect(confirmCalls.filter((c) => c.action === "archivos download")).toHaveLength(0);
  });

  it("large file (>50MB) without --yes: validation-error with --yes hint", async () => {
    let exitCode: number | undefined;
    const exitSpy = spyOn(process, "exit").mockImplementation((code?: number) => {
      exitCode = code;
      return undefined as never;
    });

    let caughtError: unknown;
    try {
      await runArchivosDownload(baseOpts("large-file", { yes: false, noInput: true }));
    } catch (e) {
      caughtError = e;
    } finally {
      exitSpy.mockRestore();
    }

    if (exitCode !== undefined) {
      expect(exitCode).toBe(1);
      expect(capturedOutput).toHaveLength(1);
      const envelope = JSON.parse(capturedOutput[0]);
      expect(envelope.ok).toBe(false);
      expect(envelope.error.code).toBe("validation-error");
    } else {
      // Error escaped the handler — still a valid outcome as long as it's the right error
      expect(caughtError).toBeDefined();
      expect((caughtError as { code?: string }).code).toBe("validation-error");
    }
  });

  it("dry-run: returns preview shape for large file without downloading", async () => {
    await runArchivosDownload(baseOpts("large-file", { dryRun: true }));
    expect(capturedOutput).toHaveLength(1);
    const envelope = JSON.parse(capturedOutput[0]);
    expect(envelope.ok).toBe(true);
    expect(envelope.data.dryRun).toBe(true);
    expect(envelope.data.display_name).toBe("big-lecture.mp4");
    expect(envelope.data.size).toBe(LARGE_FILE_SIZE);
  });

  it("dry-run: size_human field is present", async () => {
    await runArchivosDownload(baseOpts("large-file", { dryRun: true }));
    const envelope = JSON.parse(capturedOutput[0]);
    expect(envelope.data.size_human).toBeDefined();
    expect(envelope.data.size_human).toContain("MB");
  });

  it("50MB threshold: confirmT2 not called for small file, called for large file", async () => {
    // Small file: no confirm
    confirmCalls.length = 0;
    try {
      await runArchivosDownload(baseOpts("small-file", { dryRun: true }));
    } catch {}
    expect(confirmCalls.filter((c) => c.action === "archivos download")).toHaveLength(0);

    // Large file: confirm IS called (even for dry-run)
    confirmCalls.length = 0;
    capturedOutput.length = 0;
    await runArchivosDownload(baseOpts("large-file", { dryRun: true }));
    expect(confirmCalls.filter((c) => c.action === "archivos download")).toHaveLength(1);
  });

  it("large file with --yes: T2 confirm is called with yes=true", async () => {
    // With --yes, confirmT2 returns 'proceed'. Then the actual download happens.
    // We don't test the full download pipeline here (needs real fs/fetch).
    // Just assert confirmT2 was called with yes=true.
    let _exitCode: number | undefined;
    const exitSpy = spyOn(process, "exit").mockImplementation((code?: number) => {
      _exitCode = code;
      return undefined as never;
    });

    try {
      await runArchivosDownload(baseOpts("large-file", { yes: true }));
    } catch {
      // real fs ops may fail in test env
    } finally {
      exitSpy.mockRestore();
    }

    const dl = confirmCalls.find((c) => c.action === "archivos download");
    expect(dl).toBeDefined();
    expect(dl?.opts.yes).toBe(true);
  });
});
