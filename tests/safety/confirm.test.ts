import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { WienerError } from "../../src/lib/errors.ts";

// We need to mock @clack/prompts and tty before importing confirm
// Bun supports module mocking via mock.module

// --- tty mock ---
let mockIsInteractive = true;

mock.module("../../src/lib/tty.ts", () => ({
  isInteractive: () => mockIsInteractive,
  enforceNoInput: (noInput: boolean) => noInput || !mockIsInteractive,
}));

// --- clack mock ---
let mockConfirmAnswer: boolean | symbol = true;

mock.module("@clack/prompts", () => ({
  confirm: async (_opts: unknown) => mockConfirmAnswer,
  isCancel: (v: unknown) => typeof v === "symbol",
}));

// Import AFTER mocking
const { confirmT2 } = await import("../../src/lib/safety/confirm.ts");

describe("confirmT2", () => {
  describe("dry-run path", () => {
    it("returns 'dry-run' immediately when dryRun=true, regardless of yes/tty", async () => {
      const result = await confirmT2("test action", "preview text", {
        yes: false,
        dryRun: true,
        noInput: false,
      });
      expect(result).toBe("dry-run");
    });

    it("returns 'dry-run' even when yes=true and dryRun=true", async () => {
      const result = await confirmT2("test action", "preview text", {
        yes: true,
        dryRun: true,
      });
      expect(result).toBe("dry-run");
    });
  });

  describe("yes flag path", () => {
    it("returns 'proceed' when yes=true and dryRun=false", async () => {
      const result = await confirmT2("test action", "preview text", {
        yes: true,
        dryRun: false,
      });
      expect(result).toBe("proceed");
    });
  });

  describe("TTY interactive path", () => {
    beforeEach(() => {
      mockIsInteractive = true;
    });

    it("returns 'proceed' when user confirms", async () => {
      mockConfirmAnswer = true;
      const result = await confirmT2("test action", "preview text", {
        yes: false,
        dryRun: false,
        noInput: false,
      });
      expect(result).toBe("proceed");
    });

    it("returns 'aborted' when user declines", async () => {
      mockConfirmAnswer = false;
      const result = await confirmT2("test action", "preview text", {
        yes: false,
        dryRun: false,
        noInput: false,
      });
      expect(result).toBe("aborted");
    });

    it("returns 'aborted' when user presses Ctrl+C (symbol cancel)", async () => {
      mockConfirmAnswer = Symbol("cancel");
      const result = await confirmT2("test action", "preview text", {
        yes: false,
        dryRun: false,
        noInput: false,
      });
      expect(result).toBe("aborted");
    });
  });

  describe("non-TTY without --yes", () => {
    beforeEach(() => {
      mockIsInteractive = false;
    });

    afterEach(() => {
      mockIsInteractive = true;
    });

    it("throws validation-error when non-interactive and no --yes", async () => {
      let threw: unknown;
      try {
        await confirmT2("test action", "preview text", {
          yes: false,
          dryRun: false,
          noInput: false,
        });
      } catch (e) {
        threw = e;
      }
      expect(threw).toBeInstanceOf(WienerError);
      const err = threw as WienerError;
      expect(err.code).toBe("validation-error");
      expect(err.message).toContain("test action");
      expect(err.hint).toContain("--yes");
    });

    it("throws validation-error when noInput=true and no --yes", async () => {
      mockIsInteractive = true; // tty is interactive but noInput=true overrides
      let threw: unknown;
      try {
        await confirmT2("test action", "preview text", {
          yes: false,
          dryRun: false,
          noInput: true,
        });
      } catch (e) {
        threw = e;
      }
      expect(threw).toBeInstanceOf(WienerError);
      const err = threw as WienerError;
      expect(err.code).toBe("validation-error");
    });
  });
});
