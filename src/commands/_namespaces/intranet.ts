import type { Command } from "commander";
import { NotImplementedError } from "../../lib/errors.js";
import { err } from "../../lib/output/envelope.js";
import { printError } from "../../lib/output/human.js";
import { emitJson } from "../../lib/output/json.js";

function stubAction(name: string) {
  return (_args: unknown, opts: { json?: boolean }) => {
    const e = new NotImplementedError(name);
    if (opts?.json) emitJson(err(e.code, e.message, e.hint));
    printError(e.code, e.message, e.hint);
    process.exit(1);
  };
}

export function registerIntranetNamespace(program: Command): void {
  const cmd = program
    .command("intranet")
    .description(
      "Mirror namespace: intranet-backed commands (notas, horario, asistencia, plan, etc.)",
    );

  const subcommands = [
    { name: "notas", desc: "Official grades" },
    { name: "historial", desc: "Academic history" },
    { name: "horario", desc: "Class schedule" },
    { name: "asistencia", desc: "Attendance records" },
    { name: "plan", desc: "Study plan" },
    { name: "examenes", desc: "Upcoming exams" },
    { name: "matricula", desc: "Current enrollment" },
    { name: "perfil", desc: "Student profile" },
    { name: "pagos", desc: "Payments and obligations" },
    { name: "tramite", desc: "Active procedures" },
  ];

  for (const { name, desc } of subcommands) {
    cmd
      .command(`${name} [args...]`)
      .description(`${desc} (Phase B — not yet implemented)`)
      .option("--json", "Output JSON envelope")
      .allowUnknownOption(true)
      .action(stubAction(`intranet ${name}`));
  }

  // Auth subcommands mirrored
  const authCmd = cmd.command("auth").description("Auth subcommands");
  authCmd
    .command("login")
    .description("Intranet login (alias for `wiener auth login`)")
    .option("--json", "Output JSON envelope")
    .allowUnknownOption(true)
    .action(stubAction("intranet auth login (use `wiener auth login`)"));
  authCmd
    .command("logout")
    .description("Intranet logout (alias for `wiener auth logout`)")
    .option("--json", "Output JSON envelope")
    .allowUnknownOption(true)
    .action(stubAction("intranet auth logout (use `wiener auth logout`)"));
}
