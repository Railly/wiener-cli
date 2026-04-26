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

  process.stderr.write("\n");
  for (const step of steps) {
    const arrow = color ? pc.cyan("→") : "→";
    const cmd = color ? pc.cyan(step.command.padEnd(30)) : step.command.padEnd(30);
    const desc = color ? pc.dim(step.description) : step.description;
    process.stderr.write(`  ${arrow} ${cmd}  ${desc}\n`);
  }
  process.stderr.write("\n");
}

// Convenience: print next-steps to stdout (for use inside renderPanorama and similar)
export function renderNextSteps(steps: NextStep[], color: boolean): string {
  if (steps.length === 0) return "";
  const lines: string[] = [""];
  for (const step of steps) {
    const arrow = color ? pc.cyan("→") : "→";
    const cmd = color ? pc.cyan(step.command.padEnd(30)) : step.command.padEnd(30);
    const desc = color ? pc.dim(step.description) : step.description;
    lines.push(`  ${arrow} ${cmd}  ${desc}`);
  }
  lines.push("");
  return lines.join("\n");
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

// Per-command next-step sets
export const NEXT_STEPS = {
  afterAuthLogin: [
    { command: "wiener auth canvas pat new", description: "configurar Canvas" },
    { command: "wiener doctor", description: "verificar configuración" },
  ],
  afterCursos: [
    { command: "wiener cursos aliases", description: "personalizar nombres" },
    { command: "wiener tareas <codigo>", description: "ver entregas del curso" },
  ],
  afterNotas: [
    { command: "wiener notas periodos", description: "ver otros periodos" },
    { command: "wiener historial", description: "historial completo" },
  ],
  afterHorario: [
    { command: "wiener hoy", description: "horario de hoy" },
    { command: "wiener tareas hoy", description: "entregas de hoy" },
  ],
  afterHoy: [
    { command: "wiener tareas hoy", description: "entregas vencidas y de hoy" },
    { command: "wiener semana", description: "semana completa" },
  ],
  afterTareasHoy: [
    { command: "wiener tareas semana", description: "entregas de esta semana" },
    { command: "wiener calificaciones", description: "notas en Canvas" },
  ],
  afterPagos: [
    { command: "wiener tramite generar", description: "generar orden de pago" },
    { command: "wiener perfil", description: "ver datos personales" },
  ],
  authRequired: [{ command: "wiener auth login", description: "configurar acceso al intranet" }],
  canvasRequired: [
    { command: "wiener auth canvas pat new", description: "generar nuevo PAT de Canvas" },
  ],
} as const satisfies Record<string, readonly NextStep[]>;
