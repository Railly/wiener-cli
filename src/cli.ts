#!/usr/bin/env bun
import { Command } from "commander";
import { VERSION } from "./lib/version.js";

import { registerCanvasClear } from "./commands/auth/canvas/clear.js";
import { registerCanvasPatNew } from "./commands/auth/canvas/pat-new.js";
import { registerCanvasSetToken } from "./commands/auth/canvas/set-token.js";
import { registerAuthLogin } from "./commands/auth/login.js";
import { registerAuthLogout } from "./commands/auth/logout.js";
import { registerAuthStatus } from "./commands/auth/status.js";

import { registerCursosAbrir } from "./commands/cursos/abrir.js";
import { registerAliasList } from "./commands/cursos/aliases/list.js";
import { registerAliasReset } from "./commands/cursos/aliases/reset.js";
import { registerAliasWizard } from "./commands/cursos/aliases/wizard.js";
import { registerCursosFavoritos } from "./commands/cursos/favoritos.js";
import { registerCursosInfo } from "./commands/cursos/info.js";
import { registerCursosList } from "./commands/cursos/list.js";

import { makeNotasCommand } from "./commands/notas/list.js";
import { makeHorarioCommand } from "./commands/horario/week.js";
import { makeHorarioHoyCommand } from "./commands/horario/hoy.js";
import { makeHorarioAhoraCommand } from "./commands/horario/ahora.js";
import { makeAsistenciaCommand } from "./commands/asistencia.js";
import { makePlanCommand } from "./commands/plan/list.js";
import { makeHistorialCommand } from "./commands/historial.js";
import { makeExamenesCommand } from "./commands/examenes.js";
import { makeMatriculaCommand } from "./commands/matricula.js";
import { makePerfilCommand } from "./commands/perfil.js";
import { makePagosCommand } from "./commands/pagos/list.js";
import { makeTramiteCommand } from "./commands/tramite/list.js";

import { registerCanvasNamespace } from "./commands/_namespaces/canvas.js";
import { registerConfig } from "./commands/config.js";
import { registerDoctor } from "./commands/doctor.js";
import { registerSchema } from "./commands/schema.js";

import { NotImplementedError } from "./lib/errors.js";
import { err } from "./lib/output/envelope.js";
import { printError } from "./lib/output/human.js";
import { emitJson } from "./lib/output/json.js";

const program = new Command();

program
  .name("wiener")
  .description("Agent-first CLI for Universidad Norbert Wiener student portals")
  .version(VERSION, "-v, --version")
  .option("--profile <name>", "Use named profile (global)", "default")
  .option("--config <path>", "Override config directory (global)");

// Note: --json, --ndjson, etc. are defined on each subcommand.
// Commander eats parent options before passing to child; defining
// them only on subcommands ensures the subcommand action receives them.

// Default action: panorama (Phase D — stub for now)
program.action((opts: { json?: boolean }) => {
  const e = new NotImplementedError("wiener (panorama)");
  if (opts.json) emitJson(err(e.code, e.message, e.hint));
  printError(e.code, e.message, e.hint);
  console.log("  Hint: run `wiener --help` to see all available commands");
  process.exit(1);
});

// Auth
const authCmd = program
  .command("auth")
  .description("Authentication commands for intranet and Canvas");

registerAuthLogin(authCmd);
registerAuthStatus(authCmd);
registerAuthLogout(authCmd);

const canvasAuthCmd = authCmd.command("canvas").description("Canvas-specific auth commands");

registerCanvasSetToken(canvasAuthCmd);
registerCanvasPatNew(canvasAuthCmd);
registerCanvasClear(canvasAuthCmd);

// Cursos
const cursosCmd = program.command("cursos").description("List and manage courses");

registerCursosList(cursosCmd);
registerCursosInfo(cursosCmd);
registerCursosAbrir(cursosCmd);
registerCursosFavoritos(cursosCmd);

const aliasesCmd = cursosCmd.command("aliases").description("Manage course aliases");

registerAliasWizard(aliasesCmd);
registerAliasList(aliasesCmd);
registerAliasReset(aliasesCmd);

// Intranet read commands (Phase B)
const horarioCmd = makeHorarioCommand();
horarioCmd.addCommand(makeHorarioHoyCommand());
horarioCmd.addCommand(makeHorarioAhoraCommand());

program.addCommand(makeNotasCommand());
program.addCommand(horarioCmd);
program.addCommand(makeAsistenciaCommand());
program.addCommand(makePlanCommand());
program.addCommand(makeHistorialCommand());
program.addCommand(makeExamenesCommand());
program.addCommand(makeMatriculaCommand());
program.addCommand(makePerfilCommand());
program.addCommand(makePagosCommand());
program.addCommand(makeTramiteCommand());

// Intranet mirror namespace (Phase B)
const intranetNs = new Command("intranet").description(
  "Mirror namespace: intranet-backed commands (same as top-level)",
);
intranetNs.addCommand(makeNotasCommand());
const horarioCopy = makeHorarioCommand();
horarioCopy.addCommand(makeHorarioHoyCommand());
horarioCopy.addCommand(makeHorarioAhoraCommand());
intranetNs.addCommand(horarioCopy);
intranetNs.addCommand(makeAsistenciaCommand());
intranetNs.addCommand(makePlanCommand());
intranetNs.addCommand(makeHistorialCommand());
intranetNs.addCommand(makeExamenesCommand());
intranetNs.addCommand(makeMatriculaCommand());
intranetNs.addCommand(makePerfilCommand());
intranetNs.addCommand(makePagosCommand());
intranetNs.addCommand(makeTramiteCommand());
program.addCommand(intranetNs);

// Doctor
registerDoctor(program);

// Schema
registerSchema(program);

// Config
registerConfig(program);

// Canvas namespace (Phase C will replace with real commands)
registerCanvasNamespace(program);

program.parseAsync(process.argv).catch((e: Error) => {
  console.error(e.message);
  process.exit(1);
});
