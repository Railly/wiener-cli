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

import { registerCanvasNamespace } from "./commands/_namespaces/canvas.js";
import { registerIntranetNamespace } from "./commands/_namespaces/intranet.js";
import { registerStubs } from "./commands/_stub.js";
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

// Default action: panorama (Phase E — stub for now)
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

// Default cursos action: show help (no action registered)
// `wiener cursos` with no subcommand will print cursos help.

// Doctor
registerDoctor(program);

// Schema
registerSchema(program);

// Config
registerConfig(program);

// Stub all unimplemented commands (phases B/C/D/E)
registerStubs(program);

// Namespace mirrors
registerIntranetNamespace(program);
registerCanvasNamespace(program);

program.parseAsync(process.argv).catch((e: Error) => {
  console.error(e.message);
  process.exit(1);
});
