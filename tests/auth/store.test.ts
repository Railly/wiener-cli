import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(path.join(tmpdir(), "wiener-test-"));
  process.env.WIENER_CONFIG_DIR = tempDir;
  // Force Linux/non-Darwin file fallback by mocking platform
  Object.defineProperty(process, "platform", { value: "linux", configurable: true });
});

afterEach(() => {
  process.env.WIENER_CONFIG_DIR = undefined;
  Object.defineProperty(process, "platform", { value: process.platform, configurable: true });
  try {
    rmSync(tempDir, { recursive: true });
  } catch {}
});

describe("auth store — file fallback", () => {
  it("saves and loads intranet session", async () => {
    const { saveIntranetSession, loadIntranetSession } = await import(
      "../../src/lib/auth/store.js"
    );
    const session = {
      aspCookieName: "ASPSESSIONIDTEST",
      aspCookieValue: "TESTVALUE",
      perfil: "A" as const,
      codigo: "aXXXXXXXXX",
      capturedAt: new Date().toISOString(),
    };
    await saveIntranetSession(session, "test-profile");
    const loaded = await loadIntranetSession("test-profile");
    expect(loaded?.codigo).toBe("aXXXXXXXXX");
    expect(loaded?.aspCookieName).toBe("ASPSESSIONIDTEST");
  });

  it("returns null when no session stored", async () => {
    const { loadIntranetSession } = await import("../../src/lib/auth/store.js");
    const result = await loadIntranetSession("nonexistent-profile");
    expect(result).toBeNull();
  });

  it("saves and loads canvas session", async () => {
    const { saveCanvasSession, loadCanvasSession } = await import("../../src/lib/auth/store.js");
    const session = {
      token: "test-token-abc123",
      validatedAt: new Date().toISOString(),
      userId: "12345",
      name: "Test Student",
    };
    await saveCanvasSession(session, "test-profile");
    const loaded = await loadCanvasSession("test-profile");
    expect(loaded?.token).toBe("test-token-abc123");
    expect(loaded?.userId).toBe("12345");
  });

  it("wipes intranet session", async () => {
    const { saveIntranetSession, loadIntranetSession, wipeIntranetSession } = await import(
      "../../src/lib/auth/store.js"
    );
    await saveIntranetSession(
      {
        aspCookieName: "ASPSESSIONIDTEST",
        aspCookieValue: "VAL",
        perfil: "A",
        codigo: "aXXXXXXXXX",
        capturedAt: new Date().toISOString(),
      },
      "test-profile",
    );
    await wipeIntranetSession("test-profile");
    const result = await loadIntranetSession("test-profile");
    expect(result).toBeNull();
  });

  it("wipes canvas session", async () => {
    const { saveCanvasSession, loadCanvasSession, wipeCanvasSession } = await import(
      "../../src/lib/auth/store.js"
    );
    await saveCanvasSession(
      {
        token: "tok",
        validatedAt: new Date().toISOString(),
        userId: "1",
      },
      "test-profile",
    );
    await wipeCanvasSession("test-profile");
    const result = await loadCanvasSession("test-profile");
    expect(result).toBeNull();
  });
});
