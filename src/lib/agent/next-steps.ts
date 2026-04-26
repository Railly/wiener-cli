// cligentic block: next-steps (adapted for wiener-cli)
// Post-command guidance for agents and humans.

import pc from "picocolors";

export type NextStep = {
  command: string;
  description: string;
  optional?: boolean;
};

function shouldColor(): boolean {
  if (process.env.NO_COLOR) return false;
  if (process.env.FORCE_COLOR) return true;
  return Boolean(process.stdout.isTTY);
}

export function emitNextSteps(steps: NextStep[], opts: { json?: boolean } = {}): void {
  if (steps.length === 0) return;

  const isJson = Boolean(opts.json) || (!process.stdout.isTTY && opts.json !== false);

  if (isJson) {
    for (const step of steps) {
      process.stderr.write(`${JSON.stringify({ type: "next-step", ...step })}\n`);
    }
    return;
  }

  const color = shouldColor();
  const header = color ? pc.bold("Next steps:") : "Next steps:";
  process.stderr.write(`\n${header}\n`);

  for (const step of steps) {
    const marker = step.optional ? "○" : "→";
    const cmd = color ? pc.cyan(step.command) : step.command;
    const desc = color ? pc.dim(step.description) : step.description;
    process.stderr.write(`  ${marker} ${cmd}  ${desc}\n`);
  }

  process.stderr.write("\n");
}

// Auth-specific next-step hints — used by auth-error handlers
export const AUTH_NEXT_STEPS = {
  intranet: { command: "wiener auth login", description: "authenticate with intranet" },
  canvas: { command: "wiener auth canvas set-token <pat>", description: "configure Canvas PAT" },
  canvasPat: {
    command: "wiener auth canvas pat new",
    description: "generate a new PAT via browser",
  },
} as const;
