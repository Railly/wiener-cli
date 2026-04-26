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

export function registerCanvasNamespace(program: Command): void {
  const cmd = program
    .command("canvas")
    .description("Mirror namespace: Canvas-backed commands (tareas, archivos, anuncios, etc.)");

  const subcommands = [
    { name: "tareas", desc: "Assignments" },
    { name: "planner", desc: "Planner items" },
    { name: "calificaciones", desc: "Canvas grades" },
    { name: "anuncios", desc: "Announcements" },
    { name: "archivos", desc: "Course files" },
    { name: "modulos", desc: "Course modules" },
    { name: "syllabus", desc: "Course syllabus" },
    { name: "paginas", desc: "Wiki pages" },
    { name: "discusiones", desc: "Discussion topics" },
    { name: "quizzes", desc: "Quizzes" },
    { name: "conferencias", desc: "Recorded conferences" },
    { name: "calendario", desc: "Calendar events" },
    { name: "inbox", desc: "Canvas inbox" },
  ];

  for (const { name, desc } of subcommands) {
    cmd
      .command(`${name} [args...]`)
      .description(`${desc} (Phase C/D — not yet implemented)`)
      .option("--json", "Output JSON envelope")
      .allowUnknownOption(true)
      .action(stubAction(`canvas ${name}`));
  }

  // cursos mirrors to the implemented cursos commands
  const cursosCmd = cmd.command("cursos").description("Alias for `wiener cursos`");
  cursosCmd
    .command("list [args...]")
    .description("(alias for wiener cursos)")
    .allowUnknownOption(true)
    .action(stubAction("canvas cursos — use `wiener cursos`"));

  // auth canvas mirrors
  const authCmd = cmd.command("auth").description("Canvas auth subcommands");
  authCmd
    .command("set-token [pat]")
    .description("Set Canvas PAT (alias for `wiener auth canvas set-token`)")
    .option("--json", "Output JSON envelope")
    .allowUnknownOption(true)
    .action(stubAction("use `wiener auth canvas set-token`"));
  authCmd
    .command("pat new")
    .description("Generate new Canvas PAT (alias for `wiener auth canvas pat new`)")
    .allowUnknownOption(true)
    .action(stubAction("use `wiener auth canvas pat new`"));
  authCmd
    .command("clear")
    .description("Clear Canvas PAT (alias for `wiener auth canvas clear`)")
    .allowUnknownOption(true)
    .action(stubAction("use `wiener auth canvas clear`"));
}
