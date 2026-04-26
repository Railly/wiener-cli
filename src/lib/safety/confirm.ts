import { confirm } from "@clack/prompts";
import { WienerError } from "../errors.ts";
import { isInteractive } from "../tty.ts";

export type ConfirmResult = "proceed" | "dry-run" | "aborted";

export interface ConfirmT2Options {
  yes: boolean;
  dryRun: boolean;
  noInput?: boolean;
}

/**
 * T2 confirmation harness. All T2 commands must go through this before acting.
 *
 * Decision tree:
 *   dryRun       → returns 'dry-run'  (caller emits dry-run envelope, no side-effects)
 *   yes          → returns 'proceed'  (non-interactive, skip prompt)
 *   TTY + !yes   → clack confirm prompt → 'proceed' | 'aborted'
 *   !TTY + !yes  → throws validation-error (agent must pass --yes after preview)
 */
export async function confirmT2(
  action: string,
  preview: string,
  opts: ConfirmT2Options,
): Promise<ConfirmResult> {
  if (opts.dryRun) {
    return "dry-run";
  }

  if (opts.yes) {
    return "proceed";
  }

  const nonInteractive = opts.noInput === true || !isInteractive();

  if (nonInteractive) {
    throw new WienerError(
      "validation-error",
      `T2 action requires confirmation: ${action}`,
      "Pass --yes to confirm, or --dry-run to preview without acting.",
    );
  }

  // TTY interactive path
  process.stdout.write(`\n${preview}\n\n`);

  const answer = await confirm({
    message: `Continuar con: ${action}?`,
    initialValue: false,
  });

  // clack returns symbol on Ctrl+C (isCancel)
  if (typeof answer !== "boolean" || !answer) {
    return "aborted";
  }

  return "proceed";
}
