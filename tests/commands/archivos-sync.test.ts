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

// Shared mock module file items (replaces listAllFiles — Wiener restricts /files)
function buildModuleItems(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    title: `file-${i + 1}.pdf`,
    url: `https://campus.uwiener.edu.pe/files/${i + 1}/download`,
    module_id: 1,
    module_name: "SEMANA 01",
    content_id: 100 + i,
  }));
}

let mockModuleItems = buildModuleItems(5);

mock.module("../../src/lib/api/canvas/modules.ts", () => ({
  fetchModuleFileItems: async () => mockModuleItems,
  fetchModules: async () => [],
  getModulesWithItems: async () => [],
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
    throw new MockWienerError(
      "validation-error",
      "T2 action requires confirmation",
      "Pass --yes to confirm",
    );
  },
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

describe("archivos sync (modules-based)", () => {
  beforeEach(() => {
    capturedOutput.length = 0;
    capturedErrors.length = 0;
    confirmCalls.length = 0;
    mockModuleItems = buildModuleItems(5);
  });

  it("dry-run returns manifest with correct totalCount", async () => {
    await runArchivosSync(baseOpts({ dryRun: true }));
    expect(capturedOutput).toHaveLength(1);
    const envelope = JSON.parse(capturedOutput[0]);
    expect(envelope.ok).toBe(true);
    expect(envelope.data.dryRun).toBe(true);
    expect(envelope.data.manifest.totalCount).toBe(5);
    expect(envelope.data.manifest.files).toHaveLength(5);
  });

  it("dry-run manifest files include id and path", async () => {
    await runArchivosSync(baseOpts({ dryRun: true }));
    const envelope = JSON.parse(capturedOutput[0]);
    const firstFile = envelope.data.manifest.files[0];
    expect(firstFile).toHaveProperty("id");
    expect(firstFile).toHaveProperty("path");
    expect(typeof firstFile.id).toBe("number");
    expect(typeof firstFile.path).toBe("string");
  });

  it("without --yes and non-interactive: validation-error", async () => {
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

    if (exitCode !== undefined) {
      expect(exitCode).toBe(1);
      expect(capturedOutput).toHaveLength(1);
      const envelope = JSON.parse(capturedOutput[0]);
      expect(envelope.ok).toBe(false);
      expect(envelope.error.code).toBe("validation-error");
    } else {
      expect(caughtError).toBeDefined();
      expect((caughtError as { code?: string }).code).toBe("validation-error");
    }
  });

  it("with --yes: confirmation is called with yes=true", async () => {
    let _exitCode: number | undefined;
    const exitSpy = spyOn(process, "exit").mockImplementation((code?: number) => {
      _exitCode = code;
      return undefined as never;
    });

    try {
      await runArchivosSync(baseOpts({ yes: true }));
    } catch {
      // downloads may fail without real server
    } finally {
      exitSpy.mockRestore();
    }

    const dl = confirmCalls.find((c) => c.action === "archivos sync");
    expect(dl).toBeDefined();
    expect(dl?.opts.yes).toBe(true);
  });

  it("manifest totalCount matches module items count", async () => {
    mockModuleItems = buildModuleItems(3);

    await runArchivosSync(baseOpts({ dryRun: true }));
    const envelope = JSON.parse(capturedOutput[0]);
    expect(envelope.data.manifest.totalCount).toBe(3);
  });
});
