import { WienerError } from "./errors.js";

export function isInteractive(): boolean {
  return process.stdin.isTTY === true && process.stdout.isTTY === true;
}

export function enforceNoInput(flag: boolean | undefined): void {
  if (flag) {
    throw new WienerError(
      "validation-error",
      "This command requires interactive input but --no-input was set",
      {
        hint: "Provide credentials via environment variables (WIENER_INTRANET_USER, WIENER_INTRANET_PASS, etc.)",
      },
    );
  }
}

export function shouldPrompt(noInputFlag: boolean | undefined): boolean {
  if (noInputFlag) return false;
  if (!isInteractive()) return false;
  return true;
}
