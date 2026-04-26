import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const TEST_PROFILE = `test-tramite-generar-${Date.now()}`;
const TEST_STATE_DIR = join(homedir(), ".wiener", TEST_PROFILE);

// Mock auth store to return a fake session
mock.module("../../src/lib/auth/store.ts", () => ({
  loadIntranetSession: (_profile: string) => ({
    aspCookieName: "ASPSESSIONIDTEST",
    aspCookieValue: "TESTCOOKIEVALUE",
    perfil: "A",
    capturedAt: new Date().toISOString(),
    codigo: "aXXXXXXXXX",
  }),
  loadCanvasSession: () => null,
}));

// Mock confirmT2 to return 'proceed' by default (tests pass --yes equivalent)
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

// Mock tramite API
mock.module("../../src/lib/api/intranet/tramite.ts", () => ({
  fetchTramiteTipos: async () => [
    { value: "constancia", label: "Constancia de estudios", monto: "30.00" },
    { value: "certificado", label: "Certificado de notas", monto: "50.00" },
  ],
  fetchTramitePreview: async (tipo: string) => ({
    tipo,
    tipoLabel: tipo === "constancia" ? "Constancia de estudios" : tipo,
    concepto: "Constancia simple",
    monto: "S/. 30.00",
    vencimiento: "2026-05-15",
  }),
  submitTramiteGenerar: async (_tipo: string) => ({
    orden_id: "OP-2026-12345",
    monto: "S/. 30.00",
    concepto: "Constancia simple",
    vencimiento: "2026-05-15",
  }),
}));

// Mock output functions to suppress stdout in tests
const capturedOutput: string[] = [];
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
  printError: () => {},
}));

mock.module("../../src/lib/audit/log.ts", () => ({
  auditLog: () => {},
}));

const { runTramiteGenerar } = await import("../../src/commands/tramite/generar.ts");

function baseOpts(overrides: Partial<Parameters<typeof runTramiteGenerar>[0]> = {}) {
  return {
    tipo: "constancia",
    yes: true,
    dryRun: false,
    json: true,
    noInput: true,
    profile: TEST_PROFILE,
    ...overrides,
  };
}

describe("tramite generar", () => {
  beforeEach(() => {
    capturedOutput.length = 0;
    // Clean up rate guard state
    if (existsSync(TEST_STATE_DIR)) {
      rmSync(TEST_STATE_DIR, { recursive: true, force: true });
    }
  });

  it("dry-run returns { dryRun: true, ...preview } in JSON envelope", async () => {
    await runTramiteGenerar(baseOpts({ dryRun: true }));
    expect(capturedOutput).toHaveLength(1);
    const envelope = JSON.parse(capturedOutput[0]);
    expect(envelope.ok).toBe(true);
    expect(envelope.data.dryRun).toBe(true);
    expect(envelope.data.tipo).toBe("constancia");
    expect(envelope.data.monto).toBe("S/. 30.00");
  });

  it("succeeds with --yes and valid tipo", async () => {
    await runTramiteGenerar(baseOpts());
    expect(capturedOutput).toHaveLength(1);
    const envelope = JSON.parse(capturedOutput[0]);
    expect(envelope.ok).toBe(true);
    expect(envelope.data.orden_id).toBe("OP-2026-12345");
    expect(envelope.data.monto).toBe("S/. 30.00");
  });

  it("rate-limit: refuses second generar call within 60 seconds", async () => {
    // First call succeeds
    await runTramiteGenerar(baseOpts());

    // Inject a rate guard marker that simulates a recent call
    mkdirSync(TEST_STATE_DIR, { recursive: true });
    writeFileSync(
      join(TEST_STATE_DIR, "tramite-generar-last.json"),
      JSON.stringify({ ts: new Date().toISOString() }),
    );

    // Second call should be refused
    let exited = false;
    const _origExit = process.exit.bind(process);
    const exitSpy = spyOn(process, "exit").mockImplementation((_code?: number) => {
      exited = true;
      return undefined as never;
    });

    capturedOutput.length = 0;
    await runTramiteGenerar(baseOpts());

    exitSpy.mockRestore();

    expect(exited).toBe(true);
    // The error envelope should have been output
    if (capturedOutput.length > 0) {
      const envelope = JSON.parse(capturedOutput[0]);
      expect(envelope.ok).toBe(false);
      expect(envelope.error.code).toBe("rate-limited");
    }
  });

  it("validation-error on unknown tipo", async () => {
    let exited = false;
    const exitSpy = spyOn(process, "exit").mockImplementation((_code?: number) => {
      exited = true;
      return undefined as never;
    });

    await runTramiteGenerar(baseOpts({ tipo: "no-existe-este-tipo-xyz" }));
    exitSpy.mockRestore();

    expect(exited).toBe(true);
    expect(capturedOutput).toHaveLength(1);
    const envelope = JSON.parse(capturedOutput[0]);
    expect(envelope.ok).toBe(false);
    expect(envelope.error.code).toBe("validation-error");
  });

  it("preview shape is correct for dry-run", async () => {
    await runTramiteGenerar(baseOpts({ dryRun: true }));
    const envelope = JSON.parse(capturedOutput[0]);
    expect(envelope.data).toMatchObject({
      dryRun: true,
      tipo: "constancia",
      tipoLabel: "Constancia de estudios",
      concepto: "Constancia simple",
      monto: "S/. 30.00",
      vencimiento: "2026-05-15",
    });
  });
});
