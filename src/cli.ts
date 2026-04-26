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

import { makeAsistenciaCommand } from "./commands/asistencia.js";
import { makeExamenesCommand } from "./commands/examenes.js";
import { makeHistorialCommand } from "./commands/historial.js";
import { makeHorarioAhoraCommand } from "./commands/horario/ahora.js";
import { makeHorarioHoyCommand } from "./commands/horario/hoy.js";
import { makeHorarioCommand } from "./commands/horario/week.js";
import { makeMatriculaCommand } from "./commands/matricula.js";
// Phase B: Intranet read commands
import { makeNotasCommand } from "./commands/notas/list.js";
import { makePagosCommand } from "./commands/pagos/list.js";
import { makePerfilCommand } from "./commands/perfil.js";
import { makePlanCommand } from "./commands/plan/list.js";
import { makeTramiteCommand } from "./commands/tramite/list.js";

import { runAnunciosByCourse } from "./commands/anuncios/by-course.js";
import { runAnunciosGlobales } from "./commands/anuncios/globales.js";
import { runAnuncios } from "./commands/anuncios/list.js";
import { runArchivosArbol } from "./commands/archivos/arbol.js";
import { runArchivos } from "./commands/archivos/list.js";
import { runCalendarioIcs } from "./commands/calendario/ics.js";
import { runCalendario } from "./commands/calendario/list.js";
import { runCalificacionesDetail } from "./commands/calificaciones/detail.js";
import { runCalificaciones } from "./commands/calificaciones/list.js";
import { runConferencias } from "./commands/conferencias.js";
import { runDiscusiones } from "./commands/discusiones.js";
import { runInboxInfo } from "./commands/inbox/info.js";
import { runInbox } from "./commands/inbox/list.js";
import { runModulos } from "./commands/modulos.js";
import { runPaginas } from "./commands/paginas.js";
import { runPlanner } from "./commands/planner.js";
import { runQuizzes } from "./commands/quizzes.js";
import { runSyllabus } from "./commands/syllabus.js";
import { runTareasHoy } from "./commands/tareas/hoy.js";
import { runTareasInfo } from "./commands/tareas/info.js";
// Phase C: Canvas read commands
import { runTareasByCourse, runTareasList } from "./commands/tareas/list.js";
import { runTareasSemana } from "./commands/tareas/semana.js";
import type { SectionType } from "./types/course.js";

import { registerConfig } from "./commands/config.js";
import { registerDoctor } from "./commands/doctor.js";
import { registerSchema } from "./commands/schema.js";

// Phase D: panorama + daily commands
import { registerRoot } from "./commands/_root.js";
import { registerAhora } from "./commands/ahora.js";
import { registerHoy } from "./commands/hoy.js";
import { registerNuevo } from "./commands/nuevo.js";
import { registerSemana } from "./commands/semana.js";
import { registerWatch } from "./commands/watch.js";

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

// Default action: panorama (Phase D)
registerRoot(program);

// ─── Auth ────────────────────────────────────────────────────────────────────

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

// ─── Cursos ──────────────────────────────────────────────────────────────────

const cursosCmd = program.command("cursos").description("List and manage courses");

registerCursosList(cursosCmd);
registerCursosInfo(cursosCmd);
registerCursosAbrir(cursosCmd);
registerCursosFavoritos(cursosCmd);

const aliasesCmd = cursosCmd.command("aliases").description("Manage course aliases");

registerAliasWizard(aliasesCmd);
registerAliasList(aliasesCmd);
registerAliasReset(aliasesCmd);

// ─── Intranet read commands (Phase B) ────────────────────────────────────────

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

// ─── Canvas read commands (Phase C) ──────────────────────────────────────────

function parseGlobalFlags(opts: Record<string, unknown>): {
  json: boolean;
  ndjson: boolean;
  noInput: boolean;
  exact: boolean;
  fields?: string;
  seccion?: SectionType;
} {
  return {
    json: Boolean(opts.json),
    ndjson: Boolean(opts.ndjson),
    noInput: Boolean(opts.noInput) || !process.stdin.isTTY,
    exact: Boolean(opts.exact),
    fields: opts.fields as string | undefined,
    seccion: opts.seccion as SectionType | undefined,
  };
}

function addGlobalFlags(cmd: Command): Command {
  return cmd
    .option("--json", "Output as JSON envelope")
    .option("--ndjson", "Output as NDJSON stream")
    .option("--no-input", "Force non-interactive mode")
    .option("--exact", "Course resolver: exact match only")
    .option("--fields <keys>", "Project specific keys")
    .option("--seccion <sec>", "Filter by section (T, P1, P2, PD, PE)");
}

// wiener tareas
const tareas = addGlobalFlags(
  new Command("tareas")
    .description("Tareas y assignments de Canvas")
    .argument("[ref]", "Referencia de curso"),
);

tareas.action(async (ref, opts) => {
  const g = parseGlobalFlags(opts);
  if (ref) {
    await runTareasByCourse(String(ref), g);
  } else {
    await runTareasList(g);
  }
});

addGlobalFlags(tareas.command("hoy").description("Tareas que vencen hoy o están atrasadas")).action(
  async (_opts, cmd) => {
    const merged = cmd.optsWithGlobals() as Record<string, unknown>;
    await runTareasHoy(parseGlobalFlags(merged));
  },
);

addGlobalFlags(
  tareas
    .command("semana")
    .description("Tareas que vencen en los próximos 7 días")
    .option("--dias <n>", "Días a mostrar", "7"),
).action(async (_opts, cmd) => {
  const merged = cmd.optsWithGlobals() as Record<string, unknown>;
  const g = parseGlobalFlags(merged);
  await runTareasSemana({ ...g, dias: Number.parseInt(String(merged.dias ?? "7"), 10) });
});

addGlobalFlags(
  tareas
    .command("info <assignment-id>")
    .description("Detalle de una tarea (requiere --curso)")
    .requiredOption("--curso <ref>", "Curso al que pertenece la tarea"),
).action(async (assignmentId, _opts, cmd) => {
  const merged = cmd.optsWithGlobals() as Record<string, unknown>;
  const g = parseGlobalFlags(merged);
  await runTareasInfo(String(assignmentId), { ...g, curso: merged.curso as string });
});

program.addCommand(tareas);

// wiener planner
addGlobalFlags(
  program
    .command("planner")
    .description("Planner items del Canvas dashboard")
    .option("--dias <n>", "Días hacia adelante", "14"),
).action(async (opts) => {
  const g = parseGlobalFlags(opts);
  await runPlanner({ ...g, dias: Number.parseInt(String(opts.dias ?? "14"), 10) });
});

// wiener calificaciones
const cals = addGlobalFlags(
  new Command("calificaciones")
    .description("Calificaciones Canvas")
    .argument("[ref]", "Referencia de curso"),
);

cals.action(async (ref, opts) => {
  const g = parseGlobalFlags(opts);
  if (ref) {
    await runCalificacionesDetail(String(ref), g);
  } else {
    await runCalificaciones(g);
  }
});

program.addCommand(cals);

// wiener anuncios
const anuncios = addGlobalFlags(
  new Command("anuncios")
    .description("Anuncios de Canvas")
    .argument("[ref]", "Referencia de curso")
    .option("--full", "Mostrar cuerpo completo")
    .option("--ultimos <n>", "Últimos N anuncios por curso", "5"),
);

anuncios.action(async (ref, opts) => {
  const g = parseGlobalFlags(opts);
  const n = Number.parseInt(String(opts.ultimos ?? "5"), 10);
  if (ref) {
    await runAnunciosByCourse(String(ref), { ...g, full: Boolean(opts.full), ultimos: n });
  } else {
    await runAnuncios({ ...g, full: Boolean(opts.full), ultimos: n });
  }
});

addGlobalFlags(
  anuncios
    .command("globales")
    .description("Anuncios institucionales (cuenta global)")
    .option("--full"),
).action(async (_opts, cmd) => {
  const merged = cmd.optsWithGlobals() as Record<string, unknown>;
  const g = parseGlobalFlags(merged);
  await runAnunciosGlobales({ ...g, full: Boolean(merged.full) });
});

program.addCommand(anuncios);

// wiener archivos (Phase C: list/arbol — Phase E: download/sync added later)
const archivos = addGlobalFlags(
  new Command("archivos")
    .description("Archivos de cursos Canvas")
    .argument("<ref>", "Referencia de curso"),
);

archivos.action(async (ref, opts) => {
  const g = parseGlobalFlags(opts);
  await runArchivos(String(ref), g);
});

addGlobalFlags(archivos.command("arbol <ref>").description("Árbol de carpetas y archivos")).action(
  async (ref, _opts, cmd) => {
    const merged = cmd.optsWithGlobals() as Record<string, unknown>;
    const g = parseGlobalFlags(merged);
    await runArchivosArbol(String(ref), g);
  },
);

program.addCommand(archivos);

// wiener modulos
addGlobalFlags(program.command("modulos <ref>").description("Módulos del curso con items")).action(
  async (ref, opts) => {
    const g = parseGlobalFlags(opts);
    await runModulos(String(ref), g);
  },
);

// wiener syllabus
addGlobalFlags(program.command("syllabus <ref>").description("Silabo del curso")).action(
  async (ref, opts) => {
    const g = parseGlobalFlags(opts);
    await runSyllabus(String(ref), g);
  },
);

// wiener paginas
addGlobalFlags(
  program
    .command("paginas <ref>")
    .description("Páginas wiki del curso")
    .option("--full", "Incluir cuerpo de cada página"),
).action(async (ref, opts) => {
  const g = parseGlobalFlags(opts);
  await runPaginas(String(ref), { ...g, full: Boolean(opts.full) });
});

// wiener discusiones
addGlobalFlags(
  program
    .command("discusiones <ref>")
    .description("Foros de discusión del curso")
    .option("--full", "Incluir mensaje completo"),
).action(async (ref, opts) => {
  const g = parseGlobalFlags(opts);
  await runDiscusiones(String(ref), { ...g, full: Boolean(opts.full) });
});

// wiener quizzes
addGlobalFlags(program.command("quizzes <ref>").description("Quizzes del curso")).action(
  async (ref, opts) => {
    const g = parseGlobalFlags(opts);
    await runQuizzes(String(ref), g);
  },
);

// wiener conferencias
addGlobalFlags(
  program.command("conferencias <ref>").description("Conferencias y grabaciones del curso"),
).action(async (ref, opts) => {
  const g = parseGlobalFlags(opts);
  await runConferencias(String(ref), g);
});

// wiener calendario
addGlobalFlags(
  program
    .command("calendario")
    .description("Calendario de eventos")
    .option("--dias <n>", "Días a mostrar", "7")
    .option("--ics", "Descargar ICS")
    .option("--out <path>", "Ruta de salida para ICS")
    .option("--curso <ref>", "Curso específico (para --ics)"),
).action(async (opts) => {
  const g = parseGlobalFlags(opts);
  if (opts.ics) {
    await runCalendarioIcs({
      ...g,
      out: opts.out as string | undefined,
      curso: opts.curso as string | undefined,
    });
  } else {
    await runCalendario({ ...g, dias: Number.parseInt(String(opts.dias ?? "7"), 10) });
  }
});

// wiener inbox
const inbox = addGlobalFlags(
  new Command("inbox")
    .description("Mensajes Canvas")
    .option("--no-leidos", "Solo mensajes no leídos"),
);

inbox.action(async (opts) => {
  const g = parseGlobalFlags(opts);
  await runInbox({ ...g, noLeidos: Boolean(opts.noLeidos) });
});

addGlobalFlags(inbox.command("info <id>").description("Detalle de una conversación")).action(
  async (id, _opts, cmd) => {
    const merged = cmd.optsWithGlobals() as Record<string, unknown>;
    const g = parseGlobalFlags(merged);
    await runInboxInfo(String(id), g);
  },
);

program.addCommand(inbox);

// ─── Namespace mirrors ────────────────────────────────────────────────────────

// wiener intranet <cmd> — mirror namespace for intranet commands
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

// wiener canvas <cmd> — mirror namespace for Canvas commands
const canvas = new Command("canvas").description(
  "Canvas LMS commands (espejo de top-level, misma funcionalidad)",
);

addGlobalFlags(
  canvas.command("tareas [ref]").description("Ver tareas Canvas (alias: wiener tareas)"),
).action(async (ref, opts) => {
  const g = parseGlobalFlags(opts);
  if (ref) {
    await runTareasByCourse(String(ref), g);
  } else {
    await runTareasList(g);
  }
});

addGlobalFlags(
  canvas
    .command("calificaciones [ref]")
    .description("Ver calificaciones Canvas (alias: wiener calificaciones)"),
).action(async (ref, opts) => {
  const g = parseGlobalFlags(opts);
  if (ref) {
    await runCalificacionesDetail(String(ref), g);
  } else {
    await runCalificaciones(g);
  }
});

addGlobalFlags(
  canvas
    .command("anuncios [ref]")
    .description("Ver anuncios Canvas (alias: wiener anuncios)")
    .option("--ultimos <n>", "Últimos N", "5"),
).action(async (ref, opts) => {
  const g = parseGlobalFlags(opts);
  const n = Number.parseInt(String(opts.ultimos ?? "5"), 10);
  if (ref) {
    await runAnunciosByCourse(String(ref), { ...g, ultimos: n });
  } else {
    await runAnuncios({ ...g, ultimos: n });
  }
});

addGlobalFlags(
  canvas.command("inbox [id]").description("Ver inbox Canvas (alias: wiener inbox)"),
).action(async (id, opts) => {
  const g = parseGlobalFlags(opts);
  if (id) {
    await runInboxInfo(String(id), g);
  } else {
    await runInbox(g);
  }
});

addGlobalFlags(
  canvas
    .command("calendario")
    .description("Ver calendario Canvas (alias: wiener calendario)")
    .option("--dias <n>", "Días", "7"),
).action(async (opts) => {
  const g = parseGlobalFlags(opts);
  await runCalendario({ ...g, dias: Number.parseInt(String(opts.dias ?? "7"), 10) });
});

program.addCommand(canvas);

// ─── Phase D: daily snapshot commands ────────────────────────────────────────

registerHoy(program);
registerAhora(program);
registerSemana(program);
registerNuevo(program);
registerWatch(program);

// ─── Core commands ────────────────────────────────────────────────────────────

registerDoctor(program);
registerSchema(program);
registerConfig(program);

program.parseAsync(process.argv).catch((e: Error) => {
  console.error(e.message);
  process.exit(1);
});
